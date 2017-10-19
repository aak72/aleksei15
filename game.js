'use strict';

class Vector {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    plus(vector) {
        if (!(vector instanceof Vector)) {
            throw new Error('Прибавлять к вектору можно только данные типа Vector');
        }
        return new Vector(this.x + vector.x, this.y + vector.y);
    }

    times(factor = 1) {
        return new Vector(this.x * factor, this.y * factor);
    }
}

class Actor {
    constructor(pos = new Vector(0, 0), size = new Vector(1, 1), speed = new Vector(0, 0)) {
        if (!(pos instanceof Vector && size instanceof Vector && speed instanceof Vector)) {
            throw new Error('Все параметры должны быть объектоми типа Vector');
        }

        this.pos = pos;
        this.size = size;
        this.speed = speed;
    }

    get type() {
        return 'actor';
    }

    get left() {
        return this.pos.x;
    }

    get top() {
        return this.pos.y;
    }

    get right() {
        return this.pos.x + this.size.x;
    }

    get bottom() {
        return this.pos.y + this.size.y;
    }

    act() {}

    isIntersect(obj) {
        if (!(obj instanceof Actor)) {
            throw new Error('Нужно передать движущийся объект типа Actor');
        }

        if (obj === this) {
            return false;
        }
        //return (!(obj.left >= this.right || obj.right <= this.left || obj.top >= this.bottom || obj.bottom <= this.top));
        return (obj.left < this.right && obj.right > this.left && obj.top < this.bottom && obj.bottom > this.top);
    }
}

class Level {
    constructor(grid = [], actors = []) {
        this.grid = grid.slice();
        this.actors = actors.slice();
        this.height = this.grid.length;
        this.player = this.actors.find(actor => actor.type === 'player');
        this.status = null;
        this.finishDelay = 1;
        this.width = this.height > 0 ? Math.max.apply(Math, this.grid.map(function(el) {
           return el.length;
        })) : 0;
        //this.width = this.height > 0 ? Math.max(...arr, this.grid.map(function(el) {
        //    return el.length;
        //})) : 0;
        //this.width = grid.reduce((width, line) => line.length > width ? line.length : width, 0);
        // не получилось у меня с оператором спред, решил оставить, как было
    }

    isFinished() {
        return this.status !== null && this.finishDelay < 0;
    }

    actorAt(actor) {
        if (!(actor instanceof Actor)) {
            throw new Error('Необходимо использовать объект типа Actor');
        }
        return this.actors.find(elem => actor.isIntersect(elem));
    }

    obstacleAt(nextPos, size) {
        if (!(nextPos instanceof Vector) || !(size instanceof Vector)) {
            throw new Error('Прибавлять к вектору можно только данные типа Vector');
        }

        if (nextPos.x < 0 || nextPos.y < 0 || nextPos.x + size.x > this.width) {
            return 'wall';
        }

        if ((nextPos.y + size.y) >= this.height) {
            return 'lava';
        }

        const xMin = Math.floor(nextPos.x);
        const xMax = Math.ceil(nextPos.x + size.x);
        const yMin = Math.floor(nextPos.y);
        const yMax = Math.ceil(nextPos.y + size.y);
        for (let y = yMin; y < yMax; y++) {
            for (let x = xMin; x < xMax; x++) {
                const cell = this.grid[y][x]
                if (cell) {
                    return cell;
                }
            }
        }
    }

    removeActor(actor) {
        let index = this.actors.indexOf(actor);
        if(index !== -1) {
            this.actors.splice(index, 1);
        }
    }

    noMoreActors(type) {
        return !this.actors.some(elem => elem.type === type);
    }

    playerTouched(obstacle, coin) {
        if (this.status !== null) {
            return;
        }

        if (obstacle === 'lava' || obstacle === 'fireball') {
            this.status = 'lost';
        }

        if (obstacle === 'coin') {
            this.removeActor(coin);
            if(this.noMoreActors('coin')) {
                this.status = 'won';
            }
        }
    }
}

class LevelParser {
    constructor (dictionary = {}) {
        this.dictionary = dictionary;
        this.obstacle = {
            'x': 'wall',
            '!': 'lava'
        };
    }

    actorFromSymbol(symbol) {
        return this.dictionary[symbol];
    }

    obstacleFromSymbol(symbol) {
        return this.obstacle[symbol];
    }

    createGrid(arr) {
        return arr.map(elemY => elemY.split('').map(elemX => this.obstacle[elemX]));
        // извините, не понял на счёт метода obstacleAt
        // подскажите, пожалуйста )
    }

    createActors(arr = []) {
        const { dictionary } = this;
        const actors = [];

        arr.forEach((elemY, y) => elemY.split('').forEach((elemX, x) => {
            const key = dictionary[elemX];
            if (typeof key !== 'function') {
                return;
            }

            const obj = new key(new Vector(x, y));
            if (obj instanceof Actor) {
                actors.push(obj);
            }
        }));
        return actors;
    }
    // поправил форматирование чуть выше, в createActors

    parse(arr) {
        return new Level(this.createGrid(arr), this.createActors(arr));
    }
}

class Fireball extends Actor {
    constructor(pos, speed) {
        super(pos, new Vector(1, 1), speed);
    }

    get type() {
        return 'fireball';
    }

    getNextPosition(time = 1) {
        return this.pos.plus(this.speed.times(time));
    }

    handleObstacle() {
        this.speed = this.speed.times(-1);
    }

    act(time, level) {
        const nextPos = this.getNextPosition(time);
        const obstacle = level.obstacleAt(nextPos, this.size);

        if(obstacle) {
            this.handleObstacle();
        } else {
            this.pos = nextPos;
        }
    }
}

class HorizontalFireball extends Fireball {
    constructor(pos = new Vector(0, 0)) {
        super(pos, new Vector(2, 0));
    }
}

class VerticalFireball extends Fireball {
    constructor(pos = new Vector(0, 0)) {
        super(pos, new Vector(0, 2));
    }
}

class FireRain extends Fireball {
    constructor(pos = new Vector(0, 0)) {
        super(pos, new Vector(0, 3));
        this.startPos = pos;
    }

    handleObstacle() {
        this.pos = this.startPos;
    }
}

class Coin extends Actor {
    constructor(pos = new Vector(1, 1)) {
        super(new Vector(pos.x + 0.2, pos.y + 0.1), new Vector(0.6, 0.6));
        // не понял Вашей рекомендации здесь про .plus
        this.beginPos = pos;
        this.springSpeed = 8;
        this.springDist = 0.07;
        this.spring = Math.random() * Math.PI * 2;
    }

    get type() {
        return 'coin';
    }

    updateSpring(time = 1) {
        this.spring += this.springSpeed * time;
    }

    getSpringVector() {
        return new Vector(0, Math.sin(this.spring) * this.springDist);
    }

    getNextPosition(time = 1) {
        this.updateSpring(time);
        let springVector = this.getSpringVector();
        return new Vector(this.pos.x, this.pos.y + springVector.y * time);
        // не понял Вашей рекомендации здесь про .plus
    }

    act(time) {
        this.pos = this.getNextPosition(time);
    }
}

class Player extends Actor {
    constructor(pos = new Vector(1, 1)) {
        super(new Vector(pos.x, pos.y - 0.5), new Vector(0.8, 1.5));
        // не понял Вашей рекомендации здесь про .plus
    }

    get type() {
        return 'player';
    }
}

const actorDict = {
    '@': Player,
    'v': FireRain,
    '=': HorizontalFireball,
    '|': VerticalFireball,
    'o': Coin
};
const parser = new LevelParser(actorDict);

loadLevels()
    .then(schemas => runGame(JSON.parse(schemas), parser, DOMDisplay))
    .then(() => alert('Вы выиграли приз!'))
    .catch(err => alert(err));
