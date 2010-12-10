// -*- coding: utf-8 -*-
// require MisoPackage.js
// require Vector*.js

(function(){
    var thispkg = Misohena.package("Misohena", "galaxysim");

    // imports
    var Vector = thispkg.Vector;
    
    // Constants
    var G = 6.67259e-11;
    var DEFAULT_EPS = 1e9;
    var DEFAULT_THETA = 0.75;

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


})();
