// -*- coding: utf-8 -*-

(function(){
    function package(){
        var t = this;
        for(var i = 0; i < arguments.length; ++i){
            t = t[arguments[i]] || (t[arguments[i]]={});
        }
        return t;
    }
    var thispkg = package("Misohena", "galaxysim");

    var G = 6.67259e-11;

    var Vector = {
        newZero: function(){ return [0, 0];},
        newOnX: function(x){ return [x, 0];},
        newOnY: function(y){ return [0, y];},
        newXY: function(x, y){ return [x, y];},
        sub: function(a, b, dst){
            if(dst){
                dst[0] = a[0] - b[0];
                dst[1] = a[1] - b[1];
                return dst;
            }
            else{
                return [a[0] - b[0], a[1] - b[1]];
            }
        },
        add: function(a, b, dst){
            if(dst){
                dst[0] = a[0] + b[0];
                dst[1] = a[1] + b[1];
                return dst;
            }
            else{
                return [a[0] + b[0], a[1] + b[1]];
            }
        },
        mul: function(s, b, dst){
            if(dst){
                dst[0] = s*b[0];
                dst[1] = s*b[1];
            }
            else{
                return [s*b[0], s*b[1]];
            }
        },
        addMul: function(a, s, b, dst){
            if(dst){
                dst[0] = a[0] + s*b[0];
                dst[1] = a[1] + s*b[1];
                return dst;
            }
            else{
                return [a[0] + s*b[0], a[1] + s*b[1]];
            }
        },
        lengthSq: function(v) { return v[0]*v[0] + v[1]*v[1];},
        length: function(v) { return Math.sqrt(v[0]*v[0] + v[1]*v[1]);},
        setZero: function(v) { v[0] = v[1] = 0;},
        getX: function(v) { return v[0];},
        getY: function(v) { return v[1];}
    };

    // class SpaceObject
    var SpaceObject = thispkg.SpaceObject = function(mass, radius, pos, vel){
        this.mass = mass;
        this.radius = radius;
        this.position = pos || Vector.newZero();
        this.velocity = vel || Vector.newZero();
        this.acceleration = Vector.newZero();
        this.force = Vector.newZero();
    };
    SpaceObject.prototype = {
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
        },
        move: function(dt){
            if(this.isDestroyed()){return;}
            
            Vector.mul(1.0/this.mass, this.force,  this.acceleration);
            Vector.setZero(this.force);
            
            Vector.addMul(this.velocity, dt, this.acceleration,  this.velocity);
            Vector.addMul(this.position, dt, this.velocity,  this.position);
        }
    };

    // class Space
    var Space = thispkg.Space = function(){
        this.objects = [];
    };
    Space.prototype = {
        addObject: function(o) { this.objects.push(o);},
        step: function(dt) {
            resolveMultipleBodyProblem(this.objects);
            removeDestroyed(this.objects);
            this.objects.forEach(function(o){o.move(dt);});
        },
    };

    function resolveTwoBodyProblem(o1, o2)
    {
        //if(o1.isDestroyed() || o2.isDestroyed()){ return; }
        // compute distance.
        var v = Vector.sub(o2.position, o1.position);
        var r = Vector.length(v);
        
        // collision
        if(r <= o1.radius + o2.radius){
            o1.merge(o2); ///@todo 半径が大きくなるので、すでに処理したものの中にぶつかるものが出るかもしれない。
            o2.destroy();
            return;
        }

        // gravity
        var fpr = G * o1.mass * o2.mass / (r*r*r);
        Vector.addMul(o1.force,  fpr, v,  o1.force);
        Vector.addMul(o2.force, -fpr, v,  o2.force);
    }

    function resolveMultipleBodyProblem(objects)
    {
        var i, j;
        for(i = 0; i < objects.length; ++i){
            if(objects[i].isDestroyed()){ continue; }
            for(j = i+1; j < objects.length; ++j){
                if(objects[j].isDestroyed()){ continue; }
                resolveTwoBodyProblem(objects[i], objects[j]);
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

    
    //
    
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
    
    function createSpaceRandom()
    {
        function createObjectRandom()
        {
            //var radius = 1e4 + Math.random() * 6.96e8;
            //var mass = radius*radius*radius*1e3;
            //var radius = 1e4 + Math.random() * 7e7;
            var radius = 7e7;
            var mass = radius*radius*radius*5536;
            var x = Math.random()*8.0e10*(Math.random()<0.5 ? 1 : -1);
            var y = Math.random()*8.0e10*(Math.random()<0.5 ? 1 : -1);
            var vx = 0;//Math.random()*29780*(Math.random()<0.5 ? 1 : -1);
            var vy = 0;//Math.random()*29780*(Math.random()<0.5 ? 1 : -1);
            return new SpaceObject(
                mass, radius,
                Vector.newXY(x, y),
                Vector.newXY(vx, vy)
            );
        }
        var space = new Space();
        for(var i = 0; i < 50; ++i){
            space.addObject(createObjectRandom());
        }
        return space;
    }

    function createSpaceCollisionTest()
    {
        var space = new Space();
        space.addObject(new SpaceObject(1e28, 6e8, Vector.newXY(-1e11, -1e11), Vector.newXY(29780, 29780)));
        space.addObject(new SpaceObject(1e28, 6e8, Vector.newXY(1e11, -1e11), Vector.newXY(-29780, 29780)));
        return space;
    }

    function createSpaceSwingBy()
    {
        var space = new Space();
        space.addObject(new SpaceObject(
            1.899e27, 142984000/2,
            Vector.newXY(5e10, 0),
            Vector.newXY(-13069.7, 0)));
        space.addObject(new SpaceObject(
            1000, 10,
            Vector.newXY(0, -3e10),
            Vector.newXY(3800, 10000)));
        return space;
    }

    function createSpaceSwingBy2()
    {
        var space = new Space();
        space.addObject(new SpaceObject(
            1.899e27, 142984000/2,
            Vector.newXY(5e10, 0),
            Vector.newXY(-13069.7, 0)));
        space.addObject(new SpaceObject(
            1.899e27, 142984000/2,
            Vector.newXY(0, -3e10),
            Vector.newXY(3890+200, 10000)));
        return space;
    }


    //
    
    function drawSpace(cv, space)
    {
        var ctx = cv.getContext("2d");
        var width = cv.width;
        var height = cv.height;
        //var scale = (width/2)/2.0e12;
        //var scale = (width/2)/1.0e12;
        //var scale = (width/2)/2.0e11;
        var scale = (width/2)/3.0e10;

        //ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = "rgba(0,0,0,0.01)";
        ctx.fillRect(0, 0, width, height);
        
        ctx.fillStyle = "rgb(255,255,255)";
        space.objects.forEach(function(o){
            if(o.isDestroyed()){
                return;
            }
            var x = width/2 + Vector.getX(o.position) * scale;
            var y = height/2 - Vector.getY(o.position) * scale;
            ctx.beginPath();
            ctx.arc(x, y, 0.75, 0, 2*Math.PI, false);
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
        cv.getContext("2d").fillRect(0, 0, cv.width, cv.height);

        //var space = createSpaceCollisionTest();
        //var space = createSpaceRandom();
        //var space = createSpaceSwingBy();
        var space = createSpaceSwingBy2();
        //var space = createSpaceSolarSystem();

        drawSpace(cv, space);

        setInterval(function(){
            for(var i = 0; i < 80; ++i){
                space.step(3600*0.125);
            }
//            space.step(3600*24);
            drawSpace(cv, space);
/*
            document.body.appendChild(document.createElement("br"));
            document.body.appendChild(document.createTextNode(
                space.objects[0].position[0] + "\t"+
                space.objects[0].position[1] + "\t"+
                space.objects[0].velocity[0] + "\t"+
                space.objects[0].velocity[1] + "\t"+
                space.objects[1].position[0] + "\t"+
                space.objects[1].position[1] + "\t"+
                space.objects[1].velocity[0] + "\t"+
                space.objects[1].velocity[1] + "\t"
            ));
*/
        }, 100);
    }
    
    thispkg.App = {
        main: main
    };
})();
