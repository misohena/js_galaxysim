// -*- coding: utf-8 -*-
// require MisoPackage.js
// require Vector*.js

(function(){
    var mypkg = Misohena.package("Misohena", "galaxysim");

    // imports
    var Vector = mypkg.Vector;
    
    // Constants
    var G = 6.67259e-11;
    var DEFAULT_EPS = 1e9;
    var DEFAULT_THETA = 0.75;

    var MAX_RECORDING_TRACK_POINTS = 1000;

    /**
     * class EventDispatcher
     * @todo Move to library
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
                var l = list.slice(0);
                for(var i = 0; i < l.length; ++i){
                    l[i](e);
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

    var spaceObjectIdCounter = 1;
    /**
     * class SpaceObject
     */
    var SpaceObject = mypkg.SpaceObject = function(mass, radius, pos, vel){
        this.mass = mass;
        this.radius = radius;
        this.position = Vector.newClone(pos) || Vector.newZero();
        this.velocity = Vector.newClone(vel) || Vector.newZero();
        this.acceleration = Vector.newZero();
        this.phi = 0;
        this.next = null; // for linked list.
        this.id = spaceObjectIdCounter++; //unique number
    };
    SpaceObject.prototype = {
        setName: function(name){
            this.name = name;
        },
        getName: function(){
            return this.name || "Object #"+this.id;
        },
        getId: function(){
            return this.id;
        },
        getState: function(){
            var s = {
                mass: this.mass,
                radius: this.radius,
                pos: this.position,
                vel: this.velocity,
            };
            if(this.name){
                s.name = this.name;
            }
            return s;
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

        dispatchRemoveEvent: function(){
            this.dispatchEvent({type:"removefromspace", target:this});
        },
    };
    EventDispatcher.addMethodTo(SpaceObject.prototype);

    
    /**
     * class SpaceTreeNode
     */
    var MAX_SUBNODES = (1<<2); // 2^DIM
    var SpaceTreeNode = mypkg.SpaceTreeNode = function(nodeCenter, nodeSize){
        this.center = nodeCenter;
        this.size = nodeSize; //length of edge
        this.subnodes = null;
        this.firstObj = null;
        this.gravityCenter = Vector.newZero();
        this.gravityMass = 0;
    };
    SpaceTreeNode.prototype = {
        setObjects: function(firstObj){
            if(firstObj == null){
                return;
            }
            
            if(firstObj.next == null){
                this.firstObj = firstObj;
                this.subnodes = null;
                return; //leaf
            }

            // 空間分割がいつまでたっても終わらなくなるので、
            // 同じかごく近い位置のオブジェクトだけ存在する場合、
            // 一つのノードに押し込める。
            var dsize = this.size * 1e-16; //2^-53.15 means need to divide 53 levels.
            var dsize2 = dsize*dsize;
            for(var obj = firstObj.next; obj; obj = obj.next){
                if(Vector.distanceSq(obj.position, firstObj.position) > dsize2){
                    break;
                }
            }
            if(!obj){
                this.firstObj = firstObj;
                this.subnodes = null;
                return; //leaf
            }

            
            // divide the points into MAX_SUBNODES sets.
            var subnodeObjs = new Array(MAX_SUBNODES);
            for(var i = 0; i < MAX_SUBNODES; ++i){subnodeObjs[i] = null;}
            var thisCenterX = Vector.getX(this.center);
            var thisCenterY = Vector.getY(this.center);
            var objNext;
            for(var obj = firstObj; obj != null; obj = objNext){
                objNext = obj.next;
                var indexBits =
                    (Vector.getX(obj.position) > thisCenterX ? 1 : 0)+
                    (Vector.getY(obj.position) > thisCenterY ? 2 : 0);
                obj.next = subnodeObjs[indexBits];
                subnodeObjs[indexBits] = obj;
            }

            // create subnode objects.
            this.subnodes = new Array(MAX_SUBNODES);
            
            for(var indexBits = 0; indexBits < MAX_SUBNODES; ++indexBits){
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
        },
        updateCenterOfGravity: function(){
            if(this.subnodes){
                var gCenter = Vector.newZero();
                var gMass = 0;
                for(var i = 0; i < MAX_SUBNODES; ++i){
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
            else{
                if(this.firstObj && ! this.firstObj.next){ //countObj==1, fast
                    Vector.assign(this.firstObj.position,  this.gravityCenter);
                    this.gravityMass = this.firstObj.mass;
                }
                else{ //0 or 2..
                    var gCenter = Vector.newZero();
                    var gMass = 0;
                    for(var obj = this.firstObj; obj; obj = obj.next){
                        Vector.addMul(gCenter, obj.mass, obj.position,
                                      gCenter);
                        gMass += obj.mass;
                    }
                    Vector.mul(1.0/gMass, gCenter,  this.gravityCenter);
                    this.gravityMass = gMass;
                }
            }
        },
        accumulateGravityToObject: function(obj, eps2, theta2)
        {
            var v = Vector.sub(this.gravityCenter, obj.position);
            var r2 = Vector.lengthSq(v);
            if(r2*theta2 > this.size*this.size || (this.firstObj && !this.firstObj.next)){ //far enough or countObj==1
                var invR2 = 1 / (r2 + eps2);
                var invR = Math.sqrt(invR2);
                var invR3 = invR2 * invR;
                obj.phi -= this.gravityMass * invR;
                Vector.addMul(obj.acceleration, this.gravityMass*invR3, v,
                              obj.acceleration);
            }
            else if(this.subnodes){
                for(var i = 0; i < MAX_SUBNODES; ++i){
                    var snode = this.subnodes[i];
                    if(snode){
                        snode.accumulateGravityToObject(obj, eps2, theta2);
                    }
                }
            }
            else{
                for(var o2 = this.firstObj; o2; o2 = o2.next){
                    var v = Vector.sub(o2.position, obj.position);
                    var r2 = Vector.lengthSq(v);
                    var invR2 = 1 / (r2 + eps2);
                    var invR = Math.sqrt(invR2);
                    var invR3 = invR2 * invR;
                    obj.phi -= o2.mass * invR;
                    Vector.addMul(obj.acceleration, o2.mass*invR3, v,
                                  obj.acceleration);
                }
            }
        },
        countNodes: function()
        {
            var count = 1;
            for(var i = 0; i < MAX_SUBNODES; ++i){
                if(this.subnodes[i]){
                    count += this.subnodes[i].countNodes();
                }
            }
            return count;
        },
        findObjectInSquare: function(center, radius, func)
        {
            if(Vector.distanceLinf(this.center, center) <= 0.5*this.size+radius){
                if(this.subnodes){
                    for(var i = 0; i < MAX_SUBNODES; ++i){
                        if(this.subnodes[i]){
                            this.subnodes[i].findObjectInSquare(center, radius, func);
                        }
                    }
                }
                else{
                    for(var obj = this.firstObj; obj; obj = obj.next){
                        func(obj);
                    }
                }
            }
        }
    };



    /**
     * class Space
     */
    var Space = mypkg.Space = function(){
        this.objects = [];
        this.time = 0;
        this.frames = 0;
        
        this.eps = DEFAULT_EPS;
        this.eps2 = this.eps*this.eps;
        
        this.theta = DEFAULT_THETA;
        this.theta2 = this.theta*this.theta;

        this.collisionEnabled = true;
        this.trackRecordingEnabled = false;
    };
    Space.prototype = {
        getState: function(){
            return {
                time: this.time,
                frames: this.frames,
                objects: this.objects.map(function(o){return o.getState();}),
                eps: this.eps,
                theta: this.theta,
                collisionEnabled: this.collisionEnabled,
                trackRecordingEnabled: this.trackRecordingEnabled,
            };
        },
        setState: function(state){
            if(state.time !== undefined){
                this.time = state.time;
            }
            if(state.frames !== undefined){
                this.frames = state.frames;
            }
            if(state.eps !== undefined){
                this.setEpsilon(state.eps);
            }
            if(state.theta !== undefined){
                this.setTheta(state.theta);
            }
            if(state.collisionEnabled !== undefined){
                this.setCollisionEnabled(state.collisionEnabled);
            }
            if(state.trackRecordingEnabled !== undefined){
                this.setTrackRecordingEnabled(state.trackRecordingEnabled);
            }
            if(state.objects !== undefined){
                for(var oi = 0; oi < state.objects.length; ++oi){
                    var os = state.objects[oi];
                    var o = new SpaceObject(os.mass, os.radius, os.pos, os.vel)
                    if(os.name){
                        o.setName(os.name);
                    }
                    this.addObject(o);
                }
            }
        },
        getEpsilon: function() { return this.eps;},
        setEpsilon: function(v) { if(isFinite(v)){this.eps = v; this.eps2 = v*v;}},
        getTheta: function() { return this.theta;},
        setTheta: function(v) { if(isFinite(v)){this.theta = v; this.theta2 = v*v;}},
        getCollisionEnabled: function() { return this.collisionEnabled;},
        setCollisionEnabled: function(b) { this.collisionEnabled = !!b;},

        getTrackRecordingEnabled: function() { return this.trackRecordingEnabled;},
        setTrackRecordingEnabled: function(b) {
            this.trackRecordingEnabled = !!b;
            clearTracks(this.objects);
        },
        
        addObject: function(o) { this.objects.push(o);},
        removeObject: function(o) {
            var index = this.objects.indexOf(o);
            if(index >= 0){
                this.objects.splice(index, 1);
                o.dispatchRemoveEvent();
            }
        },
        step: function(dt) {
            stepObjects(dt, this.objects, this.eps2, this.theta2, this.collisionEnabled);
            removeDestroyed(this.objects);
            if(this.trackRecordingEnabled){
                recordTracks(this.objects, this.frames);
            }
            this.time += dt;
            ++this.frames;
            
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

        findObjectByName: function(name){
            for(var i = 0; i < this.objects.length; ++i){
                var o = this.objects[i];
                var n = o.name;
                if(n && n == name){
                    return o;
                }
            }
            return null;
        }
    };
    EventDispatcher.addMethodTo(Space.prototype);
    function removeDestroyed(objects)
    {
        var i;
        for(i = 0; i < objects.length; ++i){
            if(objects[i].isDestroyed()){
                objects[i].dispatchRemoveEvent();
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
            else{
                objects[i].dispatchRemoveEvent();
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
    function accumulateGravityByTree(dt, objects, eps2, theta2, collisionEnabled)
    {
        if(objects.length <= 0){
            return;
        }
        var rootNodeSize = maxDistLinf(objects);
        var rootNode = new SpaceTreeNode(Vector.newZero(), rootNodeSize*2);
        rootNode.setObjects(objectArrayToLinkedList(objects));
        rootNode.updateCenterOfGravity();
        //console.log("nodes="+rootNode.countNodes());

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
        }
            
        // detect collision
        if(collisionEnabled){
            var maxRadius = 0;
            for(var i = 0; i < objects.length; ++i){
                if(maxRadius > obj.radius){
                    maxRadius = obj.radius;
                }
            }
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

    // 全ての物体について、軌道を記録します。
    function recordTracks(objects, currFrame){
        for(var i = 0; i < objects.length; ++i){
            recordTrack(objects[i], currFrame);
        }
    }
    function clearTracks(objects){
        objects.forEach(function(obj){
            delete obj.track;
        });
    }
    function recordTrack(obj, currFrame){
        var track = obj.track || (obj.track = {
            firstFrame: currFrame,
            points:[]
        });
        //全時点ごとの全物体間の相対座標を求められるようにするために、全ての座標を保存する必要がある。
        track.points.push(Vector.newClone(obj.position));
        var d = track.points.length - MAX_RECORDING_TRACK_POINTS;
        if(d > 0){
            track.points.splice(0, d);
            track.firstFrame += d;
        }
    }

    // 全ての物体について、時間を進めます。
    function stepObjects(dt, objects, eps2, theta2, collisionEnabled)
    {
        for(var i = 0; i < objects.length; ++i){
            objects[i].predict(dt);
        }
        accumulateGravityByTree(dt, objects, eps2, theta2, collisionEnabled);
        //accumulateGravity(dt, objects, eps2);
        for(var i = 0; i < objects.length; ++i){
            objects[i].correct(dt);
        }
    }


})();
