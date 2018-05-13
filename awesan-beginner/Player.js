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
    this.isFleeing = false;
    this.enemies = '';
    this.didMove = false;

    this.previous = {
      health: 20,

      turn: -1,

      underAttack: false,
      underRangedAttack: false,
      isFleeing: false,
      enemies: '',
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

    this.findEnemies();

    if (this.didMove && this.previous.enemies.length === this.enemies.length) {
      // we moved, so all enemies stayed the same
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

    for (let direction in this.spaces) {
      for (let i = 0; i < this.spaces[direction].length; i++) {
        if (this.spaces[direction][i].isCaptive()) {
          break;
        }

        if (this.spaces[direction][i].isEnemy()) {
          this.enemies += direction + i;
          break;
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
          this.proposeAction(20, 'walk', direction);
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
          for (let i = 0; i < distance - 1; i++) {
            if (this.spaces[direction][i].isCaptive()) {
              // we don't want to shoot captives!!
              return;
            }
          }

          if ((this.enemies !== this.previous.enemies) || this.underRangedAttack) {
            this.proposeAction(60 + distance, 'shoot', direction);
          }
        }
      }
    });

  }

  tryRecover() {
    let healthLow = this.health < (this.maxHealth * 1/2);

    if (this.underAttack && healthLow) {
      // very urgent to run away
      this.proposeAction(90, 'walk', 'backward', () => {
        this.didMove = true;
      });
    }

    if (!this.underAttack && this.health < this.maxHealth) {
      this.proposeAction(50, 'rest');
    }
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

    if (space.isEmpty()) {
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