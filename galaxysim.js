// -*- coding: utf-8 -*-

(function(){
    var thispkg = Misohena.package("Misohena", "galaxysim");

    var HTML = thispkg.HTML;
    var Util = thispkg.Util;

    var CANVAS_WIDTH = 480;
    var CANVAS_HEIGHT = 480;
    
    var G = 6.67259e-11;
    var DEFAULT_DT = 3600;
    var DEFAULT_EPS = 1e9;
    var DEFAULT_THETA = 0.75;
    var DEFAULT_VIEW_SCALE = (CANVAS_WIDTH/2/2.0e11);
    var DEFAULT_VIEW_X = 0;
    var DEFAULT_VIEW_Y = 0;



    /**
     * Vector Math Utilities
     */
    var Vector = {
        newZero: function(){ return [0, 0];},
        newOnX: function(x){ return [x, 0];},
        newOnY: function(y){ return [0, y];},
        newXY: function(x, y){ return [x, y];},
        newClone: function(v) { return [v[0], v[1]];},

        // binary operator
        
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
        distanceSq: function(a, b) {
            var dx = a[0] - b[0];
            var dy = a[1] - b[1];
            return dx*dx+dy*dy;
        },
        distance: function(a, b) {
            var dx = a[0] - b[0];
            var dy = a[1] - b[1];
            return Math.sqrt(dx*dx+dy*dy);
        },
        distanceLinf: function(a, b) { return Math.max(
            Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));},

        // unary operator (return a scalar value)
        
        lengthSq: function(v) { return v[0]*v[0] + v[1]*v[1];},
        length: function(v) { return Math.sqrt(v[0]*v[0] + v[1]*v[1]);},
        lengthLinf: function(v) { return Math.max(Math.abs(v[0]), Math.abs(v[1]));},

        // setter
        
        setZero: function(v) { v[0] = v[1] = 0;},
        setXY: function(v, x, y) { v[0] = x; v[1] = y;},
        setX: function(v, x) { v[0] = x;},
        setY: function(v, y) { v[1] = y;},

        // getter
        
        getX: function(v) { return v[0];},
        getY: function(v) { return v[1];}
    };

    /**
     * class EventDispatcher
     */
    var EventDispatcher = function(){
        this.types = {};
    };
    EventDispatcher.prototype = {
        addEventListener: function(type, listener){
            var list = this.types[type] || (this.types[type] = []);
            if(list.indexOf(listener) == -1){
                list.push(listener);
            }
        },
        removeEventListener: function(type, listener){
            var list = this.types[type];
            if(list){
                var index = list.indexOf(listener);
                if(index != -1){
                    list.splice(index, 1);
                }
            }
        },
        dispatchEvent: function(e){
            var list = this.types[e.type];
            if(list){
                for(var i = 0; i < list.length; ++i){
                    list[i](e);
                }
            }
        }
    };
    EventDispatcher.internal = {
        getEventDispatcher: function(){
            return this.eventDispatcherInstance_ ||
                (this.eventDispatcherInstance_=new EventDispatcher());
        },
        addEventListener: function(type, listener){
            this.getEventDispatcher().addEventListener(type, listener);
        },
        removeEventListener: function(type, listener){
            this.getEventDispatcher().removeEventListener(type, listener);
        },
        dispatchEvent: function(e){
            this.getEventDispatcher().dispatchEvent(e);
        }
    };
    EventDispatcher.addMethodTo = function(obj){ ///@todo もっと簡潔な方法があるはず。
        for(var key in EventDispatcher.internal){
            obj[key] = EventDispatcher.internal[key];
        }
    };


    /**
     * class SpaceObject
     */
    var SpaceObject = thispkg.SpaceObject = function(mass, radius, pos, vel){
        this.mass = mass;
        this.radius = radius;
        this.position = pos || Vector.newZero();
        this.velocity = vel || Vector.newZero();
        this.acceleration = Vector.newZero();
        this.phi = 0;
        this.next = null; // for linked list.
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

            o.dispatchEvent({type:"merged", mergeTarget:this});
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
//            Vector.addMul(this.velocity, dt, this.acceleration,  this.velocity);
//            Vector.addMul(this.position, dt, this.velocity,  this.position);
//        }
        addEventListener: function(type, listener){
            var list = this.eventListeners[type];
            if(!list){
                list = this.eventListeners[type] = [];
            }
            if(list.indexOf(listener) == -1){
                list.push(listener);
            }
        },
        removeEventListener: function(type, listener){
            var list = this.eventListeners[type];
            if(list){
                var index = list.indexOf(listener);
                if(index != -1){
                    list.splice(index, 1);
                }
            }
        },
        dispatchEvent: function(e){
            var list = this.eventListeners[e.type];
            if(list){
                for(var i = 0; i < list.length; ++i){
                    list[i](e);
                }
            }
        }
    };
    EventDispatcher.addMethodTo(SpaceObject.prototype);

    
    /**
     * class SpaceTreeNode
     */
    var SpaceTreeNode = thispkg.SpaceTreeNode = function(nodeCenter, nodeSize){
        this.center = nodeCenter;
        this.size = nodeSize; //length of edge
        this.subnodes = new Array(4);
        this.firstObj = null;
        this.countObj = 0;
        this.gravityCenter = Vector.newZero();
        this.gravityMass = 0;
    };
    SpaceTreeNode.prototype = {
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
                        var snode = new SpaceTreeNode(snodeCenter, 0.5*this.size);
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
            if(this.countObj == 1 || r2*theta2 > this.size*this.size){
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



    /**
     * class Space
     */
    var Space = thispkg.Space = function(){
        this.objects = [];
        this.time = 0;
        
        this.eps = DEFAULT_EPS;
        this.eps2 = this.eps*this.eps;
        
        this.theta = DEFAULT_THETA;
        this.theta2 = this.theta*this.theta;
    };
    Space.prototype = {
        getEpsilon: function() { return this.eps;},
        setEpsilon: function(v) { if(isFinite(v)){this.eps = v; this.eps2 = v*v;}},
        getTheta: function() { return this.theta;},
        setTheta: function(v) { if(isFinite(v)){this.theta = v; this.theta2 = v*v;}},
        addObject: function(o) { this.objects.push(o);},
        step: function(dt) {
            stepObjects(dt, this.objects, this.eps2, this.theta2);
            removeDestroyed(this.objects);
            this.time += dt;
            
            this.dispatchEvent({type:"step", target:this, dt:dt});
            this.dispatchObjectChangedEvent();
        },
        dispatchObjectChangedEvent: function(){
            // stepや編集によって空間内の物体が変化したことを伝える。
            // 効率のためSpaceObjectに更新通知のためのメカニズムを実装しない。
            // SpaceObjectを直接変更した場合は、その後に必ずこのメソッドを呼ばなければならない。
            // 1つの変更につき1回呼ばなくても良い。複数変更した後に1回呼べば良い。
            this.dispatchEvent({type:"objectchanged", target:this});
        },

        findObjectOnCircle: function(center, radius, func){
            ///@todo できればツリーを使いたい。ツリーを残しておく実装にしないと。今はマウスクリック時にしか使わないので、それほど重要ではない。
            for(var i = 0; i < this.objects.length; ++i){
                var obj = this.objects[i];
                if(!obj.isDestroyed()){
                    var distSq = Vector.distanceSq(obj.position, center);
                    var sumRadius = obj.radius + radius;
                    if(distSq < sumRadius*sumRadius){
                        func(obj, Math.sqrt(distSq));
                    }
                }
            }
        },
    };
    EventDispatcher.addMethodTo(Space.prototype);
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
        var rootNode = new SpaceTreeNode(Vector.newZero(), rootNodeSize*2);
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
            // find maximum object radius used for collision detection.
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
                    if(!o2.isDestroyed() && o2 !== obj){
                        var sumRadius = o2.radius + obj.radius;
                        if(Vector.distanceSq(o2.position, obj.position) <= sumRadius*sumRadius){
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
        ///@todo 衝突判定処理
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
    // Preset Initial States
    //

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

    function enumInitialStateTitlesAsHTMLText(states){
        return states.map(function(s) { return HTML.text(s.title);});
    }
    
    var presetInitialStates = [
        // Title, SpaceFactory, ViewScale, ViewX, ViewY
        {title:"Pseudo-Solar System", factory:function(){
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
        }, scale:5e-13},
        {title:"Test Collision", factory:function(){
            var space = new Space();
            space.addObject(new SpaceObject(1e28, 6e8, Vector.newXY(-1e11, -1e11), Vector.newXY(29780, 29780)));
            space.addObject(new SpaceObject(1e28, 6e8, Vector.newXY(1e11, -1e11), Vector.newXY(-29780, 29780)));
            return space;
        }},
        {title:"Gravity Assisted Acc", factory:function(){
            var space = new Space();
            space.setEpsilon(1e2);
            space.addObject(new SpaceObject(
                1.899e27, 142984000/2,
                Vector.newXY(5e10, 0),
                Vector.newXY(-13069.7, 0)));
            space.addObject(new SpaceObject(
                1000, 10,
                Vector.newXY(0, -3e10),
                Vector.newXY(3800, 10000)));
            return space;
        }, dt:3600*0.5, scale:2e-11},
        {title:"Same Mass Passing", factory:function(){
            var space = new Space();
            space.setEpsilon(1e3);
            space.addObject(new SpaceObject(
                1.899e27, 142984000/2,
                Vector.newXY(5e10, 0),
                Vector.newXY(-13069.7, 0)));
            space.addObject(new SpaceObject(
                1.899e27, 142984000/2,
                Vector.newXY(0, -3e10),
                Vector.newXY(3890+200, 10000)));
            return space;
        }},
        {title:"Random 100", factory:function(){
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
            for(var i = 0; i < 100; ++i){
                space.addObject(createObjectRandom());
            }
            return space;
        }},
        {title:"Random 1000", factory:function(){
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
            for(var i = 0; i < 1000; ++i){
                space.addObject(createObjectRandom());
            }
            return space;
        }},
    ];



    /**
     * class Conductor
     */
    var Conductor = function(){
        this.timerId = null;
        this.dt = DEFAULT_DT;
        this.space = null;
        this.view = null;
    };
    Conductor.prototype = {
        getTimeSlice: function() { return this.dt;},
        getSpace: function() { return this.space;},
        
        setTimeSlice: function(dt){ if(isFinite(dt)){this.dt = dt;}},
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
        toggleStartStop: function(){
            if(this.timerId == null){
                this.start();
                return true;
            }
            else{
                this.stop();
                return false;
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


    /**
     * class View
     */
    var View = function()
    {
        var view = this;
        this.centerX = DEFAULT_VIEW_X;
        this.centerY = DEFAULT_VIEW_Y;
        this.scale = DEFAULT_VIEW_SCALE;
        this.timerId = null;
        this.clearRequested = false;
        this.space = null;
        this.visibleAxis = false;
        this.enabledBlur = true;

        this.trackingTarget = null;

        // create a canvas
        var cv = document.createElement("canvas");
        cv.setAttribute("width", CANVAS_WIDTH);
        cv.setAttribute("height", CANVAS_HEIGHT);
        cv.style.cssText = "border: 1px solid; background: #000;";
        var ctx = cv.getContext("2d");
        ctx.fillRect(0, 0, cv.width, cv.height);
        this.getCanvas = function(){ return cv;};
        this.getContext2D = function(){ return ctx;};

        // zoom by mouse wheel
        function zoomByMouseWheel(e){
            var delta = e.wheelDelta ? e.wheelDelta / 120
                : e.detail ? e.detail / -3
                : 0;
            if(delta < 0){
                view.zoom(0.5);
            }
            else if(delta > 0){
                view.zoom(2);
            }
            e.preventDefault();
        }
        cv.addEventListener("DOMMouseScroll", zoomByMouseWheel, false);
        cv.addEventListener("mousewheel", zoomByMouseWheel, false); //chrome

        // scroll by mouse dragging
        function beginMouseDragScroll(e){
            function moveMouseDragScroll(e){
                pos1 = Util.getMousePosOnElement(cv, e);
                view.setCenterXY(
                    viewPos0[0] - (pos1[0] - pos0[0])/view.getScale(),
                    viewPos0[1] + (pos1[1] - pos0[1])/view.getScale() );
            }
            function endMouseDragScroll(e){
                cv.removeEventListener("mousemove", moveMouseDragScroll, true);
                cv.removeEventListener("mouseup", endMouseDragScroll, true);
            }
            var viewPos0 = [view.getCenterX(), view.getCenterY()];
            var pos0 = Util.getMousePosOnElement(cv, e);
            var pos1 = pos0;
            cv.addEventListener("mousemove", moveMouseDragScroll, true);
            cv.addEventListener("mouseup", endMouseDragScroll, true);
        }
        cv.addEventListener("mousedown", beginMouseDragScroll, false);

        // select tracking target by clicking
        cv.addEventListener("mousedown", function(e){
            cv.removeEventListener("mouseup", endMouseDown, true);
            var pos0 = Util.getMousePosOnElement(cv, e);
            function endMouseDown(e){
                var pos1 = Util.getMousePosOnElement(cv, e);
                if(Math.abs(pos1[0]-pos0[0]) < 2 && Math.abs(pos1[1]-pos0[1]) < 2){
                    var x =  (pos1[0] - 0.5*view.getCanvas().width)/view.getScale() + view.getCenterX();
                    var y = -(pos1[1] - 0.5*view.getCanvas().height)/view.getScale() + view.getCenterY();
                    var r = 3/view.getScale();
                    var space = view.getSpace();
                    if(space){
                        var selectedObj = null;
                        var selectedObjDist = 0;
                        space.findObjectOnCircle(Vector.newXY(x, y), r, function(obj, dist){
                            if(!selectedObj || dist < selectedObjDist){
                                selectedObj = obj;
                                selectedObjDist = dist;
                            }
                        });
                        if(selectedObj){
                            view.setTrackingTarget(selectedObj);
                        }
                        else{
                            view.setTrackingTarget(null);
                        }
                    }
                }
            }
            cv.addEventListener("mouseup", endMouseDown, true);
            
        }, false);


        this.onMergedTrackingTargetStatic = function(e){
            view.onMergedTrackingTarget(e);
        };
    };
    View.prototype = {
        getSpace: function() { return this.space;},
        getScale: function() { return this.scale;},
        getCenterX: function() { return this.centerX;},
        getCenterY: function() { return this.centerY;},
        getVisibleAxis: function() { return this.visibleAxis;},
        getEnabledBlur: function() { return this.enabledBlur;},
        
        setSpace: function(space){
            this.setTrackingTarget(null);
            this.space = space;
            this.invalidateAndClear();
        },
        zoom: function(s){
            this.scale *= s;
            this.invalidateAndClear();
        },
        setScale: function(s){
            this.scale = s;
            this.invalidateAndClear();
        },
        setCenterXY: function(x, y){
            this.centerX = x;
            this.centerY = y;
            this.invalidateAndClear();
        },
        setVisibleAxis: function(b){
            this.visibleAxis = b;
            this.invalidateAndClear();
        },
        setEnabledBlur: function(b){
            this.enabledBlur = b;
            this.invalidateAndClear();
        },
        setTrackingTarget: function(obj){
            this.setTrackingTargetInternal(obj);
            this.invalidateAndClear();
        },
        setTrackingTargetInternal: function(obj){
            var view = this;
            if(this.trackingTarget){
                this.trackingTarget.removeEventListener("merged", view.onMergedTrackingTargetStatic);
            }
            this.trackingTarget = obj;
            if(this.trackingTarget){
                this.trackingTarget.addEventListener("merged", view.onMergedTrackingTargetStatic);
            }
        },
        onMergedTrackingTarget: function(e){
            //change tracking target to collided object.
            this.setTrackingTargetInternal(e.mergeTarget);
        },
        
        
        invalidate: function(){
            if(this.timerId == null){
                var self = this;
                this.timerId = setTimeout(function(){self.onPaint();}, 4);
            }
        },
        invalidateAndClear: function(){
            this.clearRequested = true;
            this.invalidate();
        },
        onPaint: function() {
            this.timerId = null;
            if(this.clearRequested){
                this.clearRequested = false;
                this.clearCanvas();
            }

            if(this.trackingTarget){
                this.centerX = Vector.getX(this.trackingTarget.position);
                this.centerY = Vector.getY(this.trackingTarget.position);
            }

            this.clearCanvas(this.enabledBlur ? 0.01 : 1);
            if(this.visibleAxis){
                this.drawAxis();
            }
            this.drawObjects();
            this.drawStatus();
            this.drawScaleBar();
        },
        clearCanvas: function(alpha) {
            if(alpha === undefined){
                alpha = 1;
            }
            var cv = this.getCanvas();
            var ctx = this.getContext2D();
            ctx.fillStyle = "rgba(0, 0, 0, "+alpha+")";
            ctx.fillRect(0, 0, cv.width, cv.height);
        },
        drawAxis: function(){
            var cv = this.getCanvas();
            var ctx = this.getContext2D();
            var scale = this.getScale();
            var viewX = this.getCenterX();
            var viewY = this.getCenterY();

            ctx.lineWidth = 0.75;
            if(Math.abs(viewX) < 0.5*cv.width/scale){
                var x = cv.width/2+(0-viewX)*scale;
                ctx.strokeStyle = "rgb(128,0,0)";
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, cv.height);
                ctx.stroke();
            }
            if(Math.abs(viewY) < 0.5*cv.height/scale){
                var y = cv.height/2-(0-viewY)*scale;
                ctx.strokeStyle = "rgb(0,128,0)";
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(cv.width, y);
                ctx.stroke();
            }
            
        },
        drawObjects: function(){
            var cv = this.getCanvas();
            var ctx = this.getContext2D();
            var space = this.space;
            var scale = this.getScale();
            var viewX = this.getCenterX();
            var viewY = this.getCenterY();

            ctx.fillStyle = "rgb(255,255,255)";
            for(var i = 0; i < space.objects.length; ++i){
                var o = space.objects[i];
                if(o.isDestroyed()){
                    return;
                }
                var x = cv.width/2 + (Vector.getX(o.position) - viewX) * scale;
                var y = cv.height/2 - (Vector.getY(o.position) - viewY) * scale;
                var r = o.radius * scale;
                if(r < 0.7){
                    r = 0.7;
                }
                ctx.beginPath();
                ctx.arc(x, y, r, 0, 2*Math.PI, false);
                ctx.fill();
            };
        },
        drawStatus: function(){
            var cv = this.getCanvas();
            var ctx = this.getContext2D();
            var space = this.space;
            
            var statusText = "objects:"+space.objects.length +
                " time:"+toElapsedTimeString(space.time);
            ctx.fillStyle = "rgb(128,128,128)";
            ctx.fillRect(0, 0, ctx.measureText(statusText).width, 16);
            ctx.font = "16px";
            ctx.fillStyle = "rgb(255,255,255)";
            ctx.fillText(statusText, 0, 16);
        },
        drawScaleBar: function(){
            var cv = this.getCanvas();
            var ctx = this.getContext2D();
            var scale = this.getScale();
            
            var barLenText = (0.25*cv.width/scale).toExponential()+"m";
            ctx.strokeStyle = "rgb(255,255,255)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0.25*cv.width, cv.height-8);
            ctx.lineTo(0.5*cv.width, cv.height-8);
            ctx.stroke();
            ctx.fillText(barLenText,
                         0.25*cv.width + 0.5*(0.25*cv.width-ctx.measureText(barLenText).width),
                         cv.height-8-2);
        }
    };

    function toElapsedTimeString(t)
    {
        var days = Math.floor(t / (24*60*60));
        t -= days*(24*60*60);
        var hour = Math.floor(t / (60*60));
        t -= hour*(60*60);
        var min = Math.floor(t / 60);
        t -= min*60;
        var sec = Math.floor(t);

        return days+"days "+
            ("0"+hour).slice(-2)+"h"+
            ("0"+min).slice(-2)+"m"+
            ("0"+sec).slice(-2)+"s";
    }
    
    

    function main() {
        var conductor = new Conductor();
        
        // create a canvas.
        var view = new View();
        conductor.setView(function(){view.invalidate();});
        var cv = view.getCanvas();
        document.body.appendChild(cv);

        // create a control.
        var initStateSelect;
        var initButton;
        var startButton;
        var visibleAxisCheckbox;
        var enabledBlurCheckbox;
        var timesliceTextbox;
        var epsilonTextbox;
        var thetaTextbox;
        var controlDiv = HTML.div({}, [
            initStateSelect = HTML.select(enumInitialStateTitlesAsHTMLText(presetInitialStates)),
            initButton = HTML.button("Init"),
            startButton = HTML.button("Start/Stop"),
            visibleAxisCheckbox = HTML.checkbox(view.getVisibleAxis()),
            HTML.text("Axis"),
            enabledBlurCheckbox = HTML.checkbox(view.getEnabledBlur()),
            HTML.text("Blur"),
            HTML.br(),
            HTML.text("time slice:"),
            timesliceTextbox = HTML.textbox(""),
            HTML.text("second"),
            HTML.br(),
            HTML.text("epsilon:"),
            epsilonTextbox = HTML.textbox(""),
            HTML.text("meter (potential=G*m/sqrt(r^2+epsilon^2))"),
            HTML.br(),
            HTML.text("theta:"),
            thetaTextbox = HTML.textbox(""),
        ]);
        document.body.appendChild(controlDiv);

        initButton.addEventListener("click", function(e){
            conductor.stop();
            initSpace(presetInitialStates[initStateSelect.selectedIndex]);
        }, false);
        startButton.addEventListener("click", function(e){
            conductor.toggleStartStop();
        }, false);
        visibleAxisCheckbox.addEventListener("change", function(e){
            view.setVisibleAxis(!view.getVisibleAxis());
        }, false);
        enabledBlurCheckbox.addEventListener("change", function(e){
            view.setEnabledBlur(!view.getEnabledBlur());
        }, false);
        timesliceTextbox.addEventListener("change", function(e){
            conductor.setTimeSlice(parseFloat(e.target.value));
        }, false);
        epsilonTextbox.addEventListener("change", function(e){
            conductor.getSpace().setEpsilon(parseFloat(e.target.value));
        }, false);
        thetaTextbox.addEventListener("change", function(e){
            conductor.getSpace().setTheta(parseFloat(e.target.value));
        }, false);

        function updateTextbox(){
            timesliceTextbox.value = conductor.getTimeSlice();
            epsilonTextbox.value = conductor.getSpace().getEpsilon().toExponential();
            thetaTextbox.value = conductor.getSpace().getTheta();
        }

        function initSpace(state){
            var space = state.factory();
            conductor.setSpace(space);
            conductor.setTimeSlice(state.dt || DEFAULT_DT);
            view.setTrackingTarget(null);
            view.setSpace(space);
            view.setScale(
                (state.scale !== undefined) ? 0.5*Math.min(cv.width, cv.height)*state.scale : DEFAULT_VIEW_SCALE);
            view.setCenterXY(
                state.viewX || DEFAULT_VIEW_X,
                state.viewY || DEFAULT_VIEW_Y);
            updateTextbox();
        }

        initSpace(presetInitialStates[0]);
    }
    
    thispkg.App = {
        main: main
    };
})();
