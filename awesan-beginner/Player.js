function oppositeDirection(direction) {
  switch(direction) {
    case 'forward':  return 'backward';
    case 'backward': return 'forward';
    case 'left':     return 'right';
    case 'right':    return left;
  }
}

class Player {

  constructor() {
    this.maxHealth = 20;
    this.health = 20;

    this.turn = 0;

    this.spaces = {
      forward: null,
      backward: null,
      left: null,
      right: null
    };

    this.wallsFound = {
      backward: false,
      left: false,
      forward: false,
      right: false
    }

    this.warrior = null;

    this.underAttack = false;
    this.underRangedAttack = false;
    this.runningAway = false;
    this.enemies = '';
    this.enemiesInRange = 0;
    this.enemiesInView = 0;
    this.didMove = false;

    this.previous = {
      health: 20,

      turn: -1,

      underAttack: false,
      underRangedAttack: false,
      runningAway: false,
      enemies: '',
      enemiesInRange: 0,
      enemiesInView: 0,
      didMove: false
    };

    this.actions = [];
  }

  playTurn(warrior) {
    for (let direction in this.spaces) {
      this.spaces[direction] = warrior.look(direction);
    }

    this.foreachSpace((space, direction, distance) => {
      if (space.isWall()) {
        this.wallsFound[direction] = true;
      }
    });

    this.health = warrior.health();
    this.underAttack = this.health < this.previous.health;

    if (!this.underAttack) {
      this.underRangedAttack = false;
    }

    this.underRangedAttack = this.underRangedAttack || this.underAttack && !this.touchingAnything();

    this.runningAway = this.previous.runningAway;

    this.findEnemies();

    if (this.didMove && this.enemiesInView === this.previous.enemiesInView) {
      // we moved, and all enemies stayed the same
      this.previous.enemies = this.enemies;
    }

    this.didMove = false;
    this.actions = [];
    this.pickAction(warrior);

    for (let key in this.previous) {
      this.previous[key] = this[key];
    }

    this.turn++;
  }

  findEnemies() {
    this.enemies = '';
    this.enemiesInRange = 0;
    this.enemiesInView = 0;

    for (let direction in this.spaces) {
      let didFindInDirection = false;

      for (let i = 0; i < this.spaces[direction].length; i++) {
        if (!didFindInDirection && this.spaces[direction][i].isCaptive()) {
          didFindInDirection = true;
        }

        if (this.spaces[direction][i].isEnemy()) {
          if (!didFindInDirection) {
            this.enemies += direction + i;
            this.enemiesInView++;
            didFindInDirection = true;
          }

          this.enemiesInRange++;
        }
      }
    }
  }

  pickAction(warrior) {
    this.tryRecover();
    this.tryRescue();
    this.tryAttack();
    this.tryWalk();

    // sort descending by weight
    this.actions.sort((a, b) => {
      if (a.weight > b.weight) {
        return -1;
      }
      if (a.weight < b.weight) {
        return 1;
      }

      return 0;
    });

    // execute first action
    let choice = this.actions[0];

    if (choice.direction) {
      warrior[choice.action](choice.direction);
    } else {
      warrior[choice.action]();
    }

    if (choice.callback) {
      choice.callback();
    }
  }

  proposeAction(weight, action, direction, callback) {
    this.actions.push({
      action, direction, weight, callback
    });
  }

  tryRescue() {
    this.foreachSpace((space, direction, distance) => {
      if (space.isCaptive()) {
        if (distance === 1) {
          // we're right next to a captive
          this.proposeAction(30, 'rescue', direction);
        }

        if (distance > 1) {
          // propose to chase the captive
          this.proposeAction(20, 'walk', direction, () => {
            this.didMove = true;
          });
        }
      }
    });
  }

  tryAttack() {
    this.foreachSpace((space, direction, distance) => {
      if (space.isEnemy()) {
        if (distance === 1) {
          this.proposeAction(70, 'attack', direction);
        }

        if (distance > 1) {
          for (let i = 0; i < distance - 2; i++) {
            if (this.spaces[direction][i].isCaptive() || this.spaces[direction][i].isEnemy()) {
              // we don't want to shoot captives!!
              return;
            }
          }

          if (this.enemies !== this.previous.enemies) {
            this.proposeAction(60 + distance, 'shoot', direction);
          } else if (this.underRangedAttack && this.enemiesInView > 1) {
            // we don't know which direction to chase the enemies so
            // we'll have to just shoot first

            this.proposeAction(60 + distance, 'shoot', direction);
          } else if (this.underAttack) {
            // if the enemy is ranged (which we don't know), we must
            // decide to walk there or to shoot it from a distance
            let facingEnemy = direction === 'forward';
            let projectedDamage = 3 * distance + (facingEnemy ? 0 : 1);

            if (this.health - projectedDamage > 10) {
              if (facingEnemy) {
                this.proposeAction(65 + distance, 'walk', direction, () => {
                  this.didMove = true;
                });
              } else {
                this.proposeAction(65 + distance, 'pivot', direction, () => {
                  this.didMove = true;
                });
              }
            } else {
              this.proposeAction(60 + distance, 'shoot', direction);
            }
          }
        }
      }
    });

  }

  tryRecover() {
    let healthLow = this.enemiesInRange > 1
      ? this.health < (this.maxHealth * 1/2)
      : this.health < (this.maxHealth * 2/5);

    if (this.underAttack && healthLow) {
      // very urgent to run away
      this.proposeAction(90, 'walk', 'backward', () => {
        this.didMove = true;
        this.runningAway = true;
      });
    }

    if (this.health < this.maxHealth * 3/4) {
      this.proposeAction(30, 'rest');
    }

    if (this.runningAway && !this.underAttack) {
      this.proposeAction(80, 'rest');
    }

    this.runningAway = this.runningAway && this.health < (this.maxHealth - 2);
  }

  tryWalk() {
    let space = this.spaces['forward'][0];

    let allWallsFound = true;

    for (let direction in this.spaces) {
      if (this.spaces[direction][0].isEmpty()) {
        this.proposeAction(10, 'pivot', 'backward', () => {
          this.didMove = true;
        });
      }

      if (!this.wallsFound[direction]) {
        allWallsFound = false;
      }
    }

    if (!allWallsFound && space.isStairs()) {
      return;
    }

    if (space.isEmpty() && !space.isStairs() && this.spaces['forward'][1].isWall()) {
      this.proposeAction(15, 'pivot', 'backward', () => {
        this.didMove = true;
      });
    } else if (space.isEmpty()) {
      this.proposeAction(15, 'walk', 'forward', () => {
        this.didMove = true;
      });
    }
  }

  foreachSpace(fn) {
    for (let direction in this.spaces) {
      let directionSpaces = this.spaces[direction];

      for (let i = 0; i < directionSpaces.length; i++) {
        fn(directionSpaces[i], direction, i + 1);
      }
    }
  }

  touchingAnything() {
    for (let direction in this.spaces) {
      let space = this.spaces[direction][0];

      if (!space.isEmpty() && !space.isWall()) {
        return true;
      }
    }

    return false;
  }

}