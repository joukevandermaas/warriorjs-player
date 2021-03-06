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

    this.walkingDirection = 'forward';

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

      walkingDirection: 'forward',

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

          let enemiesChanged = this.enemies !== this.previous.enemies;
          let healthLost = this.previous.health - this.health;
          let remainingEnemyLikelyRanged = !(this.enemiesInView < this.previous.enemiesInView && healthLost < 5);

          if (enemiesChanged && remainingEnemyLikelyRanged) {
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
    let projectedDamage = this.previous.health - this.health;

    if (this.underAttack) {
      if (this.underRangedAttack) {
        // we'd need to run away and we may sustain some damage
        // while doing that
        projectedDamage *= 3;
      } else {
        // the enemy behind the current one may snipe us if we
        // don't take its damage into account
        projectedDamage *= this.enemiesInRange;
      }

      let obstacles = false;

      let runDirection = oppositeDirection(this.walkingDirection);

      for (let i = 0; i < this.spaces[runDirection].length; i++) {
        if (!this.spaces[runDirection][i].isEmpty()) {
          obstacles = true;
        }
      }

      if (!obstacles && this.health - projectedDamage <= 0) {
        // very urgent to run away
        this.proposeAction(90, 'walk', runDirection, () => {
          this.didMove = true;
          this.runningAway = true;
        });
      }
    }

    let stairsInRange = false;

    this.foreachSpace((space, direction) => {
      if (space.isStairs()) {
        stairsInRange = true;
      }
    });

    if (stairsInRange && this.enemiesInRange === 0) {
      return;
    }

    if (this.health < 5) {
      if (this.enemiesInRange > 0) {
        this.proposeAction(30, 'rest');
      }
    }

    if (this.health < this.maxHealth * 3/4) {
      if (this.runningAway && !this.underAttack) {
        if (this.previous.underAttack) {
          this.proposeAction(50, 'rest');
        } else {
          this.proposeAction(80, 'rest');
        }
      }
    }

    this.runningAway = this.runningAway && this.health < (this.maxHealth - 2);
  }

  tryWalk() {
    let space = this.spaces[this.walkingDirection][0];

    let allWallsFound = true;

    for (let direction in this.spaces) {
      if (this.spaces[direction][0].isEmpty()) {
        if (this.enemiesInRange > 0) {
          this.proposeAction(10, 'pivot', direction, () => {
            this.walkingDirection = 'forward';
            this.didMove = true;
          });
        } else {
          this.proposeAction(10, 'walk', direction, () => {
            this.walkingDirection = direction;
            this.didMove = true;
          });
        }
      }

      if (!this.wallsFound[direction]) {
        allWallsFound = false;
      }
    }

    if (!allWallsFound && space.isStairs()) {
      return;
    }

    if (space.isEmpty()) {
      this.proposeAction(15, 'walk', this.walkingDirection, () => {
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