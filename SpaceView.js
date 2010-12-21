// -*- coding: utf-8 -*-
// require MisoPackage.js
// require Vector*.js
// require Space.js

(function(){
    var mypkg = Misohena.package("Misohena", "galaxysim");

    // imports
    var Vector = mypkg.Vector;
    var Vector2D = mypkg.Vector2D;


    /**
     * class SpaceView
     */
    var SpaceView = mypkg.SpaceView = function(canvasWidth, canvasHeight)
    {
        var view = this;
        this.center = Vector2D.newXY(0, 0);
        this.scale = 1;
        this.timerId = null;
        this.clearRequested = false;
        this.space = null;
        this.visibleAxis = false;
        this.visibleOrbits = false;
        this.enabledBlur = true;

        this.extraPainter = null;
        this.tracker = null;
        this.trackingTargetRelative = false;
        
        this.onSpaceObjectChanged = function(e){ view.invalidate();};
        
        // create a canvas
        var cv = document.createElement("canvas");
        cv.setAttribute("width", canvasWidth);
        cv.setAttribute("height", canvasHeight);
        var ctx = cv.getContext("2d");
        ctx.font = "13px Arial";
        ctx.textBaseline = "bottom";
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
        this.beginMouseDragScroll = function(e){
            function moveMouseDragScroll(e){
                pos1 = Vector2D.newXY(e.clientX, e.clientY);//getMousePosOnElement(cv, e);
                view.setCenter(
                    Vector2D.sub(
                        viewPos0,
                        Vector2D.negateY(
                            Vector2D.mul(
                                1/view.getScale(),
                                Vector2D.sub(pos1, pos0)))));
            }
            function endMouseDragScroll(e){
                cv.removeEventListener("mousemove", moveMouseDragScroll, true);
                cv.removeEventListener("mouseup", endMouseDragScroll, true);
            }
            var viewPos0 = view.getCenter();
            var pos0 = Vector2D.newXY(e.clientX, e.clientY);//getMousePosOnElement(cv, e);
            var pos1 = pos0;
            cv.addEventListener("mousemove", moveMouseDragScroll, true);
            cv.addEventListener("mouseup", endMouseDragScroll, true);
        };
    };
    SpaceView.prototype = {
        getSpace: function() { return this.space;},
        getScale: function() { return this.scale;},
        getCenter: function() { return Vector2D.newClone(this.center);},
        getCenterX: function() { return Vector2D.getX(this.center);},
        getCenterY: function() { return Vector2D.getY(this.center);},
        getVisibleAxis: function() { return this.visibleAxis;},
        getVisibleOrbits: function() { return this.visibleOrbits;},
        getEnabledBlur: function() { return this.enabledBlur;},
        getTrackingTargetRelative: function() { return this.trackingTargetRelative;},
        
        setSpace: function(space){
            this.setTrackingTarget(null); //release Tracking Mode
            
            if(this.space){
                this.space.removeEventListener("objectchanged", this.onSpaceObjectChanged);
            }
            this.space = space;
            if(this.space){
                this.space.addEventListener("objectchanged", this.onSpaceObjectChanged);
            }
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
        setScaleByCanvasSize: function(s){
            this.setScale(0.5*Math.min(this.getCanvas().width, this.getCanvas().height)*s);
        },
        getScaleByCanvasSize: function(){
            return this.scale / (0.5*Math.min(this.getCanvas().width, this.getCanvas().height));
        },

        setCenter: function(p){
            Vector2D.assign(p,  this.center);
            this.invalidateAndClear();
        },
        setCenterXY: function(x, y){
            Vector2D.setXY(this.center, x, y);
            this.invalidateAndClear();
        },
        setCenterXYWithoutClear: function(x, y){
            Vector2D.setXY(this.center, x, y);
            this.invalidate();
        },
        setVisibleAxis: function(b){
            this.visibleAxis = b;
            this.invalidateAndClear();
        },
        setVisibleOrbits: function(b){
            this.visibleOrbits = b;
            this.invalidateAndClear();
        },
        setEnabledBlur: function(b){
            this.enabledBlur = b;
            this.invalidateAndClear();
        },
        setTrackingTargetRelative: function(b){
            this.trackingTargetRelative = b;
            this.invalidateAndClear();
        },

        setExtraPainter: function(painter){
            this.extraPainter = painter;
            this.invalidateAndClear();
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

            this.clearCanvas(this.enabledBlur ? 0.01 : 1);
            if(this.visibleAxis){
                this.drawAxis();
            }
            if(this.visibleOrbits){
                this.drawOrbits();
            }
            this.drawObjects();
            this.drawStatus();
            this.drawScaleBar();

            if(this.extraPainter){
                this.extraPainter();
            }
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
                    continue;
                }
                var x = 0.5*cv.width + (Vector.getX(o.position) - viewX) * scale;
                var y = 0.5*cv.height - (Vector.getY(o.position) - viewY) * scale;
                var r = o.radius * scale;
                if(r < 0.7){
                    r = 0.7;
                }
                ctx.beginPath();
                ctx.arc(x, y, r, 0, 2*Math.PI, false);
                ctx.fill();
            };
        },
        drawOrbits: function(){
            var space = this.space;
            if(!space.getOrbitRecordingEnabled()){
                return;
            }
            for(var i = 0; i < space.objects.length; ++i){
                this.drawOrbit(space.objects[i]);
            }
        },
        drawOrbit: function(obj){
            if(obj.isDestroyed() || !obj.orbit){
                return;
            }

            // update path
            if(!obj.view){
                obj.view = {};
            }
            if(!obj.view.path){
                obj.view.path = new SpaceObjectSimplifiedPath();
            }
            var path = obj.view.path;
            path.addObjectPath(obj);

            // draw path
            if(path.points.length > 0){
                var ctx = this.getContext2D();
                var pos = Vector.newZero();

                ctx.strokeStyle = "#505050";
                ctx.beginPath();
            
                this.convertSpaceToCanvas(path.points[0], pos);
                ctx.moveTo(Vector.getX(pos), Vector.getY(pos));
                
                for(var i = 1; i < path.points.length; ++i){
                    this.convertSpaceToCanvas(path.points[i], pos);
                    ctx.lineTo(Vector.getX(pos), Vector.getY(pos));
                }

                ctx.stroke();
            }
        },
        drawStatus: function(){
            var cv = this.getCanvas();
            var ctx = this.getContext2D();
            var space = this.space;
            
            var statusText = "objects:"+space.objects.length +
                " time:"+toElapsedTimeString(space.time);
            ctx.fillStyle = "#004080";
            ctx.fillRect(0, 0, ctx.measureText(statusText).width, 16);
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
        },

        getObjectAtPointOnCanvas: function(pos, radius){
            var cv = this.getCanvas();
            var x =  (pos[0] - 0.5*cv.width)/this.getScale() + this.getCenterX();
            var y = -(pos[1] - 0.5*cv.height)/this.getScale() + this.getCenterY();
            var r = radius/this.getScale();
            var space = this.getSpace();
            if(space){
                var nearestObj = null;
                var nearestObjDist = 0;
                space.findObjectOnCircle(Vector.newXY(x, y), r, function(obj, dist){
                    if(!nearestObj || dist < nearestObjDist){
                        nearestObj = obj;
                        nearestObjDist = dist;
                    }
                });
                return nearestObj;
            }
            return null;
        },

        convertSpaceToCanvas: function(spacePos, dst){
            var cv = this.getCanvas();
            var scale = this.getScale();
            var viewX = this.getCenterX();
            var viewY = this.getCenterY();

            if(dst){
                Vector.setXY(
                    dst,
                    0.5*cv.width  + (Vector.getX(spacePos) - viewX) * scale,
                    0.5*cv.height - (Vector.getY(spacePos) - viewY) * scale);
                return dst;
            }
            else{
                return Vector2D.newXY(
                    0.5*cv.width  + (Vector.getX(spacePos) - viewX) * scale,
                    0.5*cv.height - (Vector.getY(spacePos) - viewY) * scale);
            }
        },

        setTrackingTarget: function(obj){
            if(this.tracker){
                this.tracker.cancel();
                this.tracker = null;
                this.invalidateAndClear();
            }
            if(obj){
                this.tracker = new SpaceView.ObjectTracker(
                    this.getSpace(),
                    obj,
                    this);
                this.invalidateAndClear();
            }
        },
        getTrackingTarget: function(){
            return this.tracker ? this.tracker.getTarget() : null;
        }
    };


    /**
     * class SpaceView.ObjectTracker
     */
    SpaceView.ObjectTracker = function(space, obj, view){
        var trackingTarget = null;
        
        // observe collision & remove.
        function onMerged(e){
            changeTrackingTarget(e.mergeTarget);
        }
        function onRemove(e){
            changeTrackingTarget(null);
        }
        function changeTrackingTarget(newTarget){
            if(trackingTarget){
                trackingTarget.removeEventListener("merged", onMerged);
                trackingTarget.removeEventListener("removefromspace", onRemove);
            }
            trackingTarget = newTarget;
            if(trackingTarget){
                trackingTarget.addEventListener("merged", onMerged);
                trackingTarget.addEventListener("removefromspace", onRemove);
            }
        }
        changeTrackingTarget(obj);

        // scroll view at each step.
        function scrollView(){
            if(trackingTarget){
                view.setCenterXYWithoutClear(
                    Vector.getX(trackingTarget.position),
                    Vector.getY(trackingTarget.position));
            }
        }
        space.addEventListener("step", scrollView);

        // scroll.
        scrollView();

        // public methods.
        this.cancel = function(){
            changeTrackingTarget(null);
            space.removeEventListener("step", scrollView);
        }
        this.getTarget = function(){
            return trackingTarget;
        }
    };

    /**
     * class SpaceObjectSimplifiedPath
     */
    function SpaceObjectSimplifiedPath(){
        this.points = [];
        this.lastDir = null;
        this.lastFrame = 0;
    }
    SpaceObjectSimplifiedPath.MAX_POINTS = 200;
    SpaceObjectSimplifiedPath.prototype = {
        addObjectPathRelative: function(targetObj, originObj){
            if(!originObj){
                this.addObjectPath(targetObj);
                return;
            }
            if(!targetObj.orbit || !originObj.orbit){
                return;
            }
            var firstFrame = Math.max(
                this.lastFrame,
                targetObj.orbit.firstFrame,
                originObj.orbit.firstFrame);
            var lastFrame = Math.max(firstFrame, Math.min(
                targetObj.orbit.firstFrame + targetObj.orbit.points.length,
                originObj.orbit.firstFrame + originObj.orbit.points.length));

            var ti = firstFrame - targetObj.orbit.firstFrame;
            var oi = firstFrame - originObj.orbit.firstFrame;
            for(var i = firstFrame; i < lastFrame; ++i, ++ti, ++oi){
                this.addPos(Vector.sub(targetObj.orbit.points[ti], originObj.orbit.points[oi]));
            }
            this.lastFrame = lastFrame;
        },
        addObjectPath: function(targetObj){
            if(!targetObj.orbit){
                return;
            }
            var firstFrame = Math.max(
                this.lastFrame,
                targetObj.orbit.firstFrame);
            var lastFrame = Math.max(
                firstFrame,
                targetObj.orbit.firstFrame + targetObj.orbit.points.length);

            var ti = firstFrame - targetObj.orbit.firstFrame;
            for(var i = firstFrame; i < lastFrame; ++i, ++ti){
                this.addPos(Vector.newClone(targetObj.orbit.points[ti]));
            }
            this.lastFrame = lastFrame;
        },
        
        addPos: function(currPos) {
            if(this.points.length <= 0){
                this.points.push(currPos);
            }
            else{
                var lastPos = this.points[this.points.length-1];
                var dir = Vector.sub(currPos, lastPos);
                var dist = Vector.length(dir);
                if(dist < 1e-16){ ///@todo
                    return;
                }
                Vector.mul(1/dist, dir,  dir);

                if(!this.lastDir || !isSameDirection(this.lastDir, dir)){
                    this.points.push(currPos);
                    this.lastDir = dir;
                    var d = this.points.length - SpaceObjectSimplifiedPath.MAX_POINTS;
                    if(d > 0){
                        this.points.splice(0, d);
                    }
                }
                else{
                    this.points[this.points.length-1] = currPos;
                }
            }
        },
    };
    function isSameDirection(a, b){
        var x = Vector.dot(a, b);
        var y = Vector.perpdot(a, b);
        return (x >= 0 && y < 0.1 && y > -0.1); ///@todo
    }
    
    
    // Utilities
    
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

})();
