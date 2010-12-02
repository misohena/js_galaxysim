// -*- coding: utf-8 -*-

if(typeof Misohena == "undefined"){
    Misohena = {};
}
if(typeof Misohena.galaxysim == "undefined"){
    Misohena.galaxysim = {};
}

(function(){
    var G = 6.67259e-11;
    var thispkg = Misohena.galaxysim;

    var Vector = {
        newZero: function(){ return [0, 0];},
        newOnX: function(x){ return [x, 0];},
        newOnY: function(y){ return [0, y];},
        newXY: function(x, y){ return [x, y];},
        sub: function(a, b){ return [a[0] - b[0], a[1] - b[1]];},
        add: function(a, b){ return [a[0] + b[0], a[1] + b[1]];},
        mul: function(a, b){ return [a*b[0], a*b[1]];},
        subTo: function(dst, a, b){ dst[0] = a[0] - b[0]; dst[1] = a[1] - b[1];},
        addTo: function(dst, a, b){ dst[0] = a[0] + b[0]; dst[1] = a[1] + b[1];},
        mulTo: function(dst, a, b){ dst[0] = a*b[0]; dst[1] = a*b[1];},
        lengthSq: function(v) { return v[0]*v[0] + v[1]*v[1];},
        length: function(v) { return Math.sqrt(v[0]*v[0] + v[1]*v[1]);},
        setZero: function(v) { v[0] = v[1] = 0;}
    };
    
    var SpaceObject = thispkg.SpaceObject = function(mass, radius, pos, vel){
        this.mass = mass;
        this.radius = radius;
        this.position = pos || Vector.newZero();
        this.velocity = vel || Vector.newZero();
        this.acceleration = Vector.newZero();
        this.force = Vector.newZero();
    };
    SpaceObject.prototype = {
        addForce: function(f) {
            Vector.addTo(this.force, this.force, f);
        },
        destroy: function(){
            this.mass = 0;
            this.radius = 0;
        },
        isDestroyed: function(){
            return this.mass <= 0;
        },
        merge: function(o){
            var newMass = this.mass + o.mass;
            var p = Vector.add(
                Vector.mul(this.mass, this.velocity),
                Vector.mul(o.mass, o.velocity));
            var newVel = Vector.mul(1 / newMass, p);

            var g = Vector.add(
                Vector.mul(this.mass, this.position),
                Vector.mul(o.mass, o.position));
            var newPos = Vector.mul(1 / newMass, g);

            this.mass = newMass;
            this.radius += o.radius; ///@todo
            this.position = newPos;
            this.velocity = newVel;
            ///@todo
            // acceleration
            // force
        }
    };

    function stepObject(o, dt)
    {
        if(o.mass <= 0){
            return;
        }
        Vector.mulTo(o.acceleration, 1.0/o.mass, o.force);
        Vector.addTo(o.velocity, o.velocity, Vector.mul(dt, o.acceleration));
        Vector.addTo(o.position, o.position, Vector.mul(dt, o.velocity));
        Vector.setZero(o.force);
    }
    
    var Space = thispkg.Space = function(){
        this.objects = [];
    };
    Space.prototype = {
        addObject: function(o) { this.objects.push(o);}
    };

    function applyGravity(o1, o2)
    {
        var v = Vector.sub(o2.position, o1.position);
        var r = Vector.length(v);
        if(r < o1.radius + o2.radius){
            o1.merge(o2);
            o2.destroy();
            return;
        }
        
        var fpr = G * o1.mass * o2.mass / (r*r*r);
        o1.addForce(Vector.mul( fpr, v));
        o2.addForce(Vector.mul(-fpr, v));
    }

    function applyGravityAll(objects)
    {
        var i, j;
        for(i = 0; i < objects.length; ++i){
            for(j = i+1; j < objects.length; ++j){
                applyGravity(objects[i], objects[j]);
            }
        }
    }

    function removeDestroyed(objects)
    {
        var i;
        for(i = 0; i < objects.length; ++i){
            if(objects[i].isDestroyed()){
                break;
            }
        }
        if(i == objects.length){
            return;
        }
        var j = i;
        for(++i; i < objects.length; ++i){
            if(!objects[i].isDestroyed()){
                objects[j++] = objects[i];
            }
        }
        objects.length = j;
    }

    function stepSpaceTime(space, dt)
    {
        applyGravityAll(space.objects);
        removeDestroyed(space.objects);
        space.objects.forEach(function(o){stepObject(o, dt);});
    }

    function createSpaceSolarSystem()
    {
        var space = new Space();
        // Sun
        space.addObject(new SpaceObject(1.9891e30, 6.96e8, Vector.newZero()));
        // Mercury
        space.addObject(new SpaceObject(3.302e23, 4879400/2, Vector.newOnX(57910000000), Vector.newOnY(47872.5)));
        // Venus
        space.addObject(new SpaceObject(4.869e24, 12103600/2, Vector.newOnX(108208930000), Vector.newOnY(35021.4)));
        // Earth
        space.addObject(new SpaceObject(5.9736e24, 6.356752e3, Vector.newOnX(1.49597870e11), Vector.newOnY(29780)));
        // Mars
        space.addObject(new SpaceObject(6.419e23, 6794400/2, Vector.newOnX(227936640000), Vector.newOnY(24130.9)));
        // Jupiter
        space.addObject(new SpaceObject(1.899e27, 142984000/2, Vector.newOnX(778412010000), Vector.newOnY(13069.7)));
        // Saturn
        space.addObject(new SpaceObject(5.688e26, 120536000/2, Vector.newOnX(1426725400000), Vector.newOnY(9672.4)));
        // Uranus
        //space.addObject(new SpaceObject(, , Vector.newOnX(), Vector.newOnY()));
        // Neptune
        //space.addObject(new SpaceObject(, , Vector.newOnX(), Vector.newOnY()));
        return space;
    }
    
    function createObjectRandom()
    {
        var radius = 1e4 + Math.random() * 6.96e8;
        var mass = radius*radius*radius*1e3;
        return new SpaceObject(
            mass, radius,
            Vector.newXY(Math.random()*8.0e11*(Math.random()<0.5 ? 1 : -1), Math.random()*8.0e11*(Math.random()<0.5 ? 1 : -1)),
            Vector.newXY(Math.random()*29780*(Math.random()<0.5 ? 1 : -1), Math.random()*29780*(Math.random()<0.5 ? 1 : -1))
        );
    }

    function createSpace()
    {
        var space = new Space();
        for(var i = 0; i < 50; ++i){
            space.addObject(createObjectRandom());
        }
        /*
        space.addObject(new SpaceObject(1e24, 6e8, Vector.newXY(-1e11, -1e11), Vector.newXY(29780, 29780)));
        space.addObject(new SpaceObject(1e24, 6e8, Vector.newXY(1e11, -1e11), Vector.newXY(-29780, 29780)));
*/
        return space;
    }

    
    function drawSpace(cv, space)
    {
        var ctx = cv.getContext("2d");
        var width = cv.width;
        var height = cv.height;
        var scale = (width/2)/2.0e12;

        //ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = "rgba(0,0,0,0.01)";
        ctx.fillRect(0, 0, width, height);
        
        ctx.fillStyle = "rgb(255,255,255)";
        space.objects.forEach(function(o){
            if(o.isDestroyed()){
                return;
            }
            var x = width/2 + o.position[0] * scale;
            var y = height/2 - o.position[1] * scale;
            ctx.beginPath();
            ctx.arc(x, y, 1, 0, 2*Math.PI, false);
            ctx.fill();
        });

    }

    function main() {
        // create canvas
        var cv = document.createElement("canvas");
        cv.setAttribute("width", 480);
        cv.setAttribute("height", 480);
        cv.style.cssText = "border: 1px solid;";
        document.body.appendChild(cv);

        var space = createSpace();
        //var space = createSpaceSolarSystem();

        drawSpace(cv, space);

        setInterval(function(){
            stepSpaceTime(space, 3600*24*5);
            drawSpace(cv, space);
        }, 100);
    }
    
    thispkg.App = {
        main: main
    };
})();
