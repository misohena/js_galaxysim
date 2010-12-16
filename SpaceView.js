// -*- coding: utf-8 -*-
// require MisoPackage.js
// require Vector*.js
// require Space.js

(function(){
    var thispkg = Misohena.package("Misohena", "galaxysim");

    // imports
    var Vector = thispkg.Vector;
    var Vector2D = thispkg.Vector2D;


    /**
     * class SpaceView
     */
    var SpaceView = thispkg.SpaceView = function(canvasWidth, canvasHeight)
    {
        var view = this;
        this.center = Vector2D.newXY(0, 0);
        this.scale = 1;
        this.timerId = null;
        this.clearRequested = false;
        this.space = null;
        this.visibleAxis = false;
        this.enabledBlur = true;

        this.extraPainter = null;
        
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
        getEnabledBlur: function() { return this.enabledBlur;},
        
        setSpace: function(space){
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
        setEnabledBlur: function(b){
            this.enabledBlur = b;
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
                    return;
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

        convertSpaceToCanvas: function(spacePos){
            var cv = this.getCanvas();
            var scale = this.getScale();
            var viewX = this.getCenterX();
            var viewY = this.getCenterY();

            return Vector2D.newXY(
                0.5*cv.width  + (Vector.getX(spacePos) - viewX) * scale,
                0.5*cv.height - (Vector.getY(spacePos) - viewY) * scale);
        },
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
    };


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
