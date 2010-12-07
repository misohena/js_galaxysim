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

    var HTML = thispkg.HTML;
    var Util = thispkg.Util;
    
    var G = 6.67259e-11;
    var EPS = 1e9;
    var THETA = 0.75;
    var EPS2 = EPS*EPS;
    var THETA2 = THETA*THETA;

    //
    // Vector Math Utilities
    //
    
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
        assign: function(src, dst){ //addとかと同じようにdstを右に統一する。
            if(dst){
                dst[0] = src[0];
                dst[1] = src[1];
                return dst;
            }
            else{
                return [src[0], src[1]];
            }
        },
        lengthSq: function(v) { return v[0]*v[0] + v[1]*v[1];},
        length: function(v) { return Math.sqrt(v[0]*v[0] + v[1]*v[1]);},
        distanceSq: function(a, b) {
            var dx = a[0] - b[0];
            var dy = a[1] - b[1];
            return dx*dx+dy*dy;
        },
        distanceLinf: function(a, b) { return Math.max(
            Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));},
        setZero: function(v) { v[0] = v[1] = 0;},
        getX: function(v) { return v[0];},
        getY: function(v) { return v[1];}
    };

    //
    // class SpaceNode
    //
    
    var SpaceNode = thispkg.SpaceNode = function(nodeCenter, nodeSize){
        this.center = nodeCenter;
        this.size = nodeSize; //length of edge
        this.subnodes = new Array(4);
        this.firstObj = null;
        this.countObj = 0;
        this.gravityCenter = Vector.newZero();
        this.gravityMass = 0;
    };
    SpaceNode.prototype = {
        setObjects: function(firstObj){
            if(firstObj == null){
            }
            else if(firstObj.next == null){
                firstObj.next = this.firstObj;
                this.firstObj = firstObj;
                this.countObj = 1;
            }
            else{
                // divide the points into four sets.
                var subnodeObjs = [null, null, null, null];//new Array(4);
                var count = 0;
                var objNext;
                for(var obj = firstObj; obj != null; obj = objNext, ++count){
                    objNext = obj.next;
                    var indexBits =
                        (Vector.getX(obj.position)>Vector.getX(this.center) ? 1 : 0)+
                        (Vector.getY(obj.position)>Vector.getY(this.center) ? 2 : 0);
                    obj.next = subnodeObjs[indexBits];
                    subnodeObjs[indexBits] = obj;
                }
                this.countObj = count;

                // create subnode objects.
                for(var indexBits = 0; indexBits < 4; ++indexBits){
                    if(subnodeObjs[indexBits]){
                        var qsize = 0.25 * this.size;
                        var snodeCenter = Vector.newXY(
                            (indexBits&1) ? qsize : -qsize,
                            (indexBits&2) ? qsize : -qsize);
                        Vector.add(snodeCenter, this.center,  snodeCenter);
                        var snode = new SpaceNode(snodeCenter, 0.5*this.size);
                        snode.setObjects(subnodeObjs[indexBits]);
                        this.subnodes[indexBits] = snode;
                    }
                    else{
                        this.subnodes[indexBits] = null;
                    }
                }
            }
        },
        updateCenterOfGravity: function(){
            if(this.countObj > 1){
                var gCenter = Vector.newZero();
                var gMass = 0;
                for(var i = 0; i < 4; ++i){
                    var snode = this.subnodes[i];
                    if(snode){
                        snode.updateCenterOfGravity();
                        Vector.addMul(gCenter, snode.gravityMass, snode.gravityCenter,
                                      gCenter);
                        gMass += snode.gravityMass;
                    }
                }
                Vector.mul(1.0/gMass, gCenter,  this.gravityCenter);
                this.gravityMass = gMass;
            }
            else if(this.countObj == 1){
                Vector.assign(this.firstObj.position,  this.gravityCenter);
                this.gravityMass = this.firstObj.mass;
            }
            else{
                Vector.setZero(this.gravityCenter);
                this.gravityMass = 0;
            }
        },
        accumulateGravityToObject: function(obj, eps2, theta2)
        {
            var v = Vector.sub(this.gravityCenter, obj.position);
            var r2 = Vector.lengthSq(v);
            if(r2*theta2 > this.size*this.size || this.countObj == 1){
                var invR2 = 1 / (r2 + eps2);
                var invR = Math.sqrt(invR2);
                var invR3 = invR2 * invR;
                obj.phi -= this.gravityMass * invR;
                Vector.addMul(obj.acceleration, this.gravityMass*invR3, v,
                              obj.acceleration);
            }
            else{
                for(var i = 0; i < 4; ++i){
                    var snode = this.subnodes[i];
                    if(snode){
                        snode.accumulateGravityToObject(obj, eps2, theta2);
                    }
                }
            }
        },
        countNodes: function()
        {
            var count = 1;
            for(var i = 0; i < 4; ++i){
                if(this.subnodes[i]){
                    count += this.subnodes[i].countNodes();
                }
            }
            return count;
        },
        findObjectInSquare: function(center, radius, func)
        {
            if(Vector.distanceLinf(this.center, center) <= 0.5*this.size+radius){
                if(this.countObj == 1){
                    func(this.firstObj);
                }
                else if(this.countObj > 1){
                    for(var i = 0; i < 4; ++i){
                        if(this.subnodes[i]){
                            this.subnodes[i].findObjectInSquare(center, radius, func);
                        }
                    }
                }
            }
        }
    };

    //
    
    function maxDistLinf(objects)
    {
        var d = 0;
        for(var i = 0; i < objects.length; ++i){
            var x = Vector.getX(objects[i].position);
            var y = Vector.getY(objects[i].position);
            if(x < 0){x = -x;}
            if(y < 0){y = -y;}
            if(x > d){
                d = x;
            }
            if(y > d){
                d = y;
            }
        }
        return d; ///@todo できれば2^nに合わせたい。境界部分で切り捨て誤差が生じるので。
    }

    function objectArrayToLinkedList(objects)
    {
        if(objects.length < 1){
            return null;
        }
        for(var i = 1; i < objects.length; ++i){
            objects[i-1].next = objects[i];
        }
        objects[objects.length-1].next = null;
        return objects[0];
    }

    // 全ての物体について、他の全ての物体との引力を積算します。
    // 四分木を使用します。
    function accumulateGravityByTree(dt, objects, eps2, theta2)
    {
        if(objects.length <= 0){
            return;
        }
        var rootNodeSize = maxDistLinf(objects);
        var rootNode = new SpaceNode(Vector.newZero(), rootNodeSize*2);
        rootNode.setObjects(objectArrayToLinkedList(objects));
        rootNode.updateCenterOfGravity();
        //console.log("nodes="+rootNode.countNodes());

        var maxRadius = 0;
        for(var i = 0; i < objects.length; ++i){
            // accumulate gravity.
            var obj = objects[i];
            if(obj.isDestroyed()){
                continue;
            }
            Vector.setZero(obj.acceleration);
            obj.phi = obj.mass / Math.sqrt(eps2);
            rootNode.accumulateGravityToObject(obj, eps2, theta2);
            Vector.mul(G, obj.acceleration,  obj.acceleration); //ここでGを掛けた方が実行効率はよいが、invR3〜のところで掛けた方がaccelerationの意味(単位)が明確かもしれない。
            // find maximum radius
            if(maxRadius > obj.radius){
                maxRadius = obj.radius;
            }
        }
            
        // detect collision
        for(var i = 0; i < objects.length; ++i){
            var obj = objects[i];
            if(obj.isDestroyed()){
                continue;
            }
            rootNode.findObjectInSquare(
                obj.position, obj.radius + maxRadius,
                function(o2){
                    if(o2 !== obj){
                        var sumRadius = o2.radius + obj.radius;
                        if(!o2.isDestroyed() && Vector.distanceSq(o2.position, obj.position) < sumRadius*sumRadius){
                            //console.log("collided");
                            obj.merge(o2);
                            o2.destroy();
                        }
                    }
                });
        }
    }

    // 全ての物体について、他の全ての物体との引力を積算します。
    function accumulateGravity(dt, objects, eps2)
    {
        if(objects.length <= 0){
            return;
        }

        for(var i = 0; i < objects.length; ++i){
            var obj1 = objects[i];
            Vector.setZero(obj1.acceleration);
            obj1.phi = 0;
            for(var j = 0; j < objects.length; ++j){
                if(j == i){
                    continue;
                }
                var obj2 = objects[j];

                var v = Vector.sub(obj2.position, obj1.position);
                var r2 = Vector.lengthSq(v);
                var invR2 = 1 / (r2 + eps2);
                var invR = Math.sqrt(invR2);
                var invR3 = invR2 * invR;
                obj1.phi -= obj2.mass * invR;
                Vector.addMul(obj1.acceleration, obj2.mass*invR3, v,
                              obj1.acceleration);
            }
            Vector.mul(G, obj1.acceleration, obj1.acceleration);
        }
    }

    // 全ての物体について、時間を進めます。
    function stepObjects(dt, objects, eps2, theta2)
    {
        for(var i = 0; i < objects.length; ++i){
            objects[i].predict(dt);
        }
        accumulateGravityByTree(dt, objects, eps2, theta2);
        //accumulateGravity(dt, objects, eps2);
        for(var i = 0; i < objects.length; ++i){
            objects[i].correct(dt);
        }
    }

    //
    // class SpaceObject
    //
    var SpaceObject = thispkg.SpaceObject = function(mass, radius, pos, vel){
        this.mass = mass;
        this.radius = radius;
        this.position = pos || Vector.newZero();
        this.velocity = vel || Vector.newZero();
        this.acceleration = Vector.newZero();
        this.phi = 0;
        this.next = null;
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

            var r1 = this.radius;
            var r2 = o.radius;
            var newRadius = Math.pow(r1*r1*r1 + r2*r2*r2, 1.0/3.0);
            
            this.mass = newMass;
            this.radius = newRadius;
            this.position = newPos;
            this.velocity = newVel;
            ///@todo
            // acceleration
        },
        predict: function(dt){
            Vector.addMul(this.position, dt, this.velocity,
                          this.position);
            Vector.addMul(this.position, 0.5*dt*dt, this.acceleration,
                          this.position);
            Vector.addMul(this.velocity, 0.5*dt, this.acceleration,
                          this.velocity);
        },
        correct: function(dt){
            Vector.addMul(this.velocity, 0.5*dt, this.acceleration,
                          this.velocity);
        },
//        move: function(dt){
//            if(this.isDestroyed()){return;}
//            
//            Vector.mul(1.0/this.mass, this.force,  this.acceleration);
//            Vector.setZero(this.force);
//            
//            Vector.addMul(this.velocity, dt, this.acceleration,  this.velocity);
//            Vector.addMul(this.position, dt, this.velocity,  this.position);
//        }
    };

    //
    // class Space
    //
    var Space = thispkg.Space = function(){
        this.objects = [];
        this.time = 0;
    };
    Space.prototype = {
        addObject: function(o) { this.objects.push(o);},
        step: function(dt) {
            stepObjects(dt, this.objects, EPS2, THETA2);
            removeDestroyed(this.objects);
            this.time += dt;
        }
    };

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
    //
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

    function randomPositionInCircle()
    {
        for(;;){
            var x = 2.0*Math.random() - 1.0;
            var y = 2.0*Math.random() - 1.0;
            if(x*x+y*y < 1){
                return Vector.newXY(x, y);
            }
        }
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
            var pos = randomPositionInCircle();
            Vector.mul(8.0e10, pos, pos);
            var vx = 0;//Math.random()*29780*(Math.random()<0.5 ? 1 : -1);
            var vy = 0;//Math.random()*29780*(Math.random()<0.5 ? 1 : -1);
            return new SpaceObject(
                mass, radius,
                pos,
                Vector.newXY(vx, vy)
            );
        }
        var space = new Space();
        for(var i = 0; i < 20; ++i){
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

    function toElapsedTimeString(t)
    {
        var days = Math.floor(t / (24*60*60));
        t -= days*(24*60*60);
        var hour = Math.floor(t / (60*60));
        t -= hour*(60*60);
        var min = Math.floor(t / 60);
        t -= min*60;
        var sec = t;

        return days+"days "+
            ("0"+hour).slice(-2)+"h"+
            ("0"+min).slice(-2)+"m"+
            sec+"s";
    }
    
    function drawSpace(cv, ctx, space, viewScale, viewX, viewY)
    {
        var width = cv.width;
        var height = cv.height;
        var scale = viewScale;

        //ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = "rgba(0,0,0, 0.01)";
        ctx.fillRect(0, 0, width, height);
        
        ctx.fillStyle = "rgb(255,255,255)";
        space.objects.forEach(function(o){
            if(o.isDestroyed()){
                return;
            }
            var x = width/2 + (Vector.getX(o.position) - viewX) * scale;
            var y = height/2 - (Vector.getY(o.position) - viewY) * scale;
            var r = o.radius * scale;
            //ctx.beginPath();
            //ctx.arc(x, y, r, 0, 2*Math.PI, false);
            //ctx.stroke();
            ctx.beginPath();
            //ctx.arc(x, y, 0.75, 0, 2*Math.PI, false);
            ctx.arc(x, y, r*8, 0, 2*Math.PI, false);
            ctx.fill();
        });

        // Status
        var statusText = "objects:"+space.objects.length +
            " time:"+toElapsedTimeString(space.time);
        ctx.fillStyle = "rgb(128,128,128)";
        ctx.fillRect(0, 0, ctx.measureText(statusText).width, 16);
        ctx.font = "16px";
        ctx.fillStyle = "rgb(255,255,255)";
        ctx.fillText(statusText, 0, 16);

        // Scale
        var barLenText = (0.25*width/scale).toExponential()+"m";
        ctx.strokeStyle = "rgb(255,255,255)";
        ctx.beginPath();
        ctx.moveTo(0.25*width, height-8);
        ctx.lineTo(0.5*width, height-8);
        ctx.stroke();
        ctx.fillText(barLenText,
                     0.25*width + 0.5*(0.25*width-ctx.measureText(barLenText).width),
                     height-8-2);
    }

    var Conductor = function(){
        this.timerId = null;
        this.dt = 3600;
        this.space = null;
        this.view = null;
    }
    Conductor.prototype = {
        setTimeSlice: function(dt){ this.dt = dt;},
        setSpace: function(space){ this.space = space;},
        setView: function(view) { this.view = view;},
        start: function(){
            if(this.space && this.timerId == null){
                var self = this;
                this.timerId = setInterval(function(){self.onTime();}, 10);
            }
        },
        stop: function(){
            if(this.timerId != null){
                clearInterval(this.timerId);
                this.timerId = null;
            }
        },
        onTime: function(){
            if(this.space){
                this.space.step(this.dt);
                if(this.view){
                    this.view();
                }
            }
        }
    };
    

    function main() {
        var conductor = new Conductor();
        conductor.setTimeSlice(3600*1);
        
        // create a canvas.
        var cv = document.createElement("canvas");
        cv.setAttribute("width", 480);
        cv.setAttribute("height", 480);
        cv.style.cssText = "border: 1px solid;";
        document.body.appendChild(cv);
        var ctx = cv.getContext("2d");
        ctx.fillRect(0, 0, cv.width, cv.height);

        function zoomByMouseWheel(e){
            var delta = e.wheelDelta ? e.wheelDelta / 120
                : e.detail ? e.detail / 3
                : 0;
            if(delta < 0){
                viewScale *= 0.5;
            }
            else if(delta > 0){
                viewScale *= 2;
            }
            e.preventDefault();
        }
        cv.addEventListener("DOMMouseScroll", zoomByMouseWheel, false);
        cv.addEventListener("mousewheel", zoomByMouseWheel, false); //chrome

        function beginMouseDragScroll(e){
            function moveMouseDragScroll(e){
                pos1 = Util.getMousePosOnElement(cv, e);
                viewX = viewPos0[0] - (pos1[0] - pos0[0])/viewScale;
                viewY = viewPos0[1] + (pos1[1] - pos0[1])/viewScale;
            }
            function endMouseDragScroll(e){
                cv.removeEventListener("mousemove", moveMouseDragScroll, true);
                cv.removeEventListener("mouseup", endMouseDragScroll, true);
            }
            var viewPos0 = [viewX, viewY];
            var pos0 = Util.getMousePosOnElement(cv, e);
            var pos1 = pos0;
            cv.addEventListener("mousemove", moveMouseDragScroll, true);
            cv.addEventListener("mouseup", endMouseDragScroll, true);
        }
        cv.addEventListener("mousedown", beginMouseDragScroll, false);

        // create a controller.
        var stopButton;
        var startButton;
        var controlDiv = HTML.div({}, [
            stopButton = HTML.button("stop"),
            startButton = HTML.button("start")
        ]);
        document.body.appendChild(controlDiv);

        
        stopButton.addEventListener("click", function(e){conductor.stop();}, false);
        startButton.addEventListener("click", function(e){conductor.start();}, false);

        // create a document.
        //var space = createSpaceCollisionTest();
        var space = createSpaceRandom();
        //var space = createSpaceSwingBy();
        //var space = createSpaceSwingBy2();
        //var space = createSpaceSolarSystem();
        conductor.setSpace(space);
        conductor.setView(function(){drawSpace(cv, ctx, space, viewScale, viewX, viewY);});

        //
        var viewScale = (cv.width/2)/
//            2.0e12;
//            1.0e12;
            2.0e11;
//            3.0e10;
        var viewX = 0;
        var viewY = 0;
        drawSpace(cv, ctx, space, viewScale, viewX, viewY);
/*
        setInterval(function(){
//            for(var i = 0; i < 80; ++i){
//                space.step(3600*0.125);
//            }
            space.step(3600*1);
            drawSpace(cv, ctx, space);

//             document.body.appendChild(document.createElement("br"));
//             document.body.appendChild(document.createTextNode(
//                 space.objects[0].position[0] + "\t"+
//                 space.objects[0].position[1] + "\t"+
//                 space.objects[0].velocity[0] + "\t"+
//                 space.objects[0].velocity[1] + "\t"+
//                 space.objects[1].position[0] + "\t"+
//                 space.objects[1].position[1] + "\t"+
//                 space.objects[1].velocity[0] + "\t"+
//                 space.objects[1].velocity[1] + "\t"
//             ));

        }, 10);
*/
    }
    
    thispkg.App = {
        main: main
    };
})();
