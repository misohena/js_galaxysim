// -*- coding: utf-8 -*-
// require MisoPackage.js
// require Utility.js
// require Vector.js
// require Space.js

// TODO: 追跡モードが解除できないのを何とかする。
// TODO: openObjectPropertyWindowで位置を少しずつずらす。
// TODO: EditModeで選択中の物体を円で囲み、速度ベクトルを表示する。それを使って速度ベクトルを変更できるようにする。
// TODO: EditMode時にEditModeWindowを表示する。物体の追加や状態の保存・復元ができる。
// TODO: 新しい物体を追加できるようにする。
// TODO: スクリプトから新しい物体を追加できるようにする。
// TODO: プリセット空間に空の空間を追加する。
// TODO: 現在の状態をテキストに出力できるようにする。
// TODO: jsonテキストから状態を復元できるようにする。
// TODO: 現在の状態をクッキーに出力できるようにする。
// TODO: View下のコントロールを枠で囲む。
// TODO: jsファイルを分割する。シミュレーションのコア部分をspace.jsへ。プリセット状態はpresets.jsへ。
// TODO: index.htmlを書く。
// TODO: 公開する。

(function(){
    var thispkg = Misohena.package("Misohena", "galaxysim");

    // imports
    var HTML = thispkg.HTML;
    var Util = thispkg.Util;
    var Vector = thispkg.Vector;
    var Space = thispkg.Space;
    var SpaceObject = thispkg.SpaceObject;

    // Constants
    var CANVAS_WIDTH = 480;
    var CANVAS_HEIGHT = 480;
    
    var DEFAULT_DT = 3600;
    var DEFAULT_VIEW_SCALE = (CANVAS_WIDTH/2/2.0e11);
    var DEFAULT_VIEW_X = 0;
    var DEFAULT_VIEW_Y = 0;


    //
    // Utilities
    //
    /**
     * マウス一筆書きで終わる操作を実装するオブジェクトを作成します。
     * @param canvasElem マウスイベントを検出する要素です。
     * @param funcBeginStroke ストローク開始時に呼び出す関数です。この関数はストローク中やストローク終了時に呼び出すメソッドを含むオブジェクトを返す必要があります。
     * @return 操作を中止するためのインタフェースを返します。
     */
    function createOneStrokeMouseOperationImpl(mousedownElem, canvasElem, funcBeginStroke)
    {
        function beginStroke(ev) {
            /*
             * currは次のメソッドを含みます。
             * - onMouseMove
             * - onEndStroke
             * - onCancelStroke
             */
            var curr = funcBeginStroke(ev);
            
            function startToListen(){
                if(curr.onMouseMove){
                    canvasElem.addEventListener("mousemove", curr.onMouseMove, true);
                }
                canvasElem.addEventListener("mouseup", endStroke, true);
            }
            function stopToListen(){
                if(curr.onMouseMove){
                    canvasElem.removeEventListener("mousemove", curr.onMouseMove, true);
                }
                canvasElem.removeEventListener("mouseup", endStroke, true);
            }
            function endStroke(ev){
                stopToListen();
                currStroke = null;
                if(curr.onEndStroke){
                    curr.onEndStroke();
                }
            }
            function cancelStroke(){
                stopToListen();
                currStroke = null;
                if(curr.onCancelStroke){
                    curr.onCancelStroke();
                }
            }
            startToListen();
            return { cancel: cancelStroke };
        }
        var currStroke = null;
        function onMouseDown(ev){
            if(!currStroke){
                currStroke = beginStroke(ev);
            }
        }
        function cancelStroke(){
            if(currStroke){
                currStroke.cancel();
            }
        }
        
        mousedownElem.addEventListener("mousedown", onMouseDown, false);
        function close(){
            mousedownElem.removeEventListener("mousedown", onMouseDown, false);
            cancelStroke();
        }
        return {
            close: close,
            cancelStroke: cancelStroke
        };
    }
    
    function createWindowDraggingOperationImpl(parent, windowDiv, captionDiv) {
        function beginWindowMove(ev){
            var windowPos0 = Util.getElementAbsPos(windowDiv);
            var pos0 = Util.getMousePosOnElement(parent, ev);
            var pos1 = pos0;
            return {
                onMouseMove: function(ev){
                    pos1 = Util.getMousePosOnElement(parent, ev);
                    var windowPos1 = [
                        windowPos0[0]+(pos1[0]-pos0[0]),
                        windowPos0[1]+(pos1[1]-pos0[1])
                    ];
                    windowDiv.style.left = windowPos1[0] + "px";
                    windowDiv.style.top = windowPos1[1] + "px";
                }
            };
        }
        return createOneStrokeMouseOperationImpl(captionDiv, parent, beginWindowMove);
    }
    
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
        this.beginMouseDragScroll = function(e){
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
        setCenterXYWithoutClear: function(x, y){
            this.centerX = x;
            this.centerY = y;
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
        },

        getObjectAtPointOnCanvas: function(pos){
            var cv = this.getCanvas();
            var x =  (pos[0] - 0.5*cv.width)/this.getScale() + this.getCenterX();
            var y = -(pos[1] - 0.5*cv.height)/this.getScale() + this.getCenterY();
            var r = 3/this.getScale();
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
    };


    /**
     * class ObjectTracker
     */
    function ObjectTracker(space, obj, view){
        // observe collision.
        var trackingTarget = null;
        function onMerged(e){
            changeTrackingTarget(e.mergeTarget);
        }
        function changeTrackingTarget(newTarget){
            if(trackingTarget){
                trackingTarget.removeEventListener("merged", onMerged);
            }
            trackingTarget = newTarget;
            if(trackingTarget){
                trackingTarget.addEventListener("merged", onMerged);
            }
        }
        changeTrackingTarget(obj);

        // scroll view at each step.
        function trackTarget(){
            view.setCenterXYWithoutClear(
                Vector.getX(trackingTarget.position),
                Vector.getY(trackingTarget.position));
        }
        space.addEventListener("step", trackTarget);

        // scroll.
        trackTarget();

        // public methods.
        this.cancel = function(){
            changeTrackingTarget(null);
            space.removeEventListener("step", trackTarget);
        }
    }

    /**
     * class ViewMode
     */
    function ViewMode(space, conductor, view){
        this.view = view;
        var cv = view.getCanvas();

        // manage tracking state.
        var tracker = null;
        function setTrackingTarget(obj){
            view.invalidateAndClear();
            if(tracker){
                tracker.cancel();
                tracker = null;
            }
            if(obj){
                tracker = new ObjectTracker(space, obj, view);
            }
        }
        
        function onMouseDown(e){
            var pos0 = Util.getMousePosOnElement(cv, e);
            var obj = view.getObjectAtPointOnCanvas(pos0);
            if(obj){
                // select tracking target by clicking
                setTrackingTarget(obj);
            }
            else{
                view.beginMouseDragScroll(e);
            }
        }
        cv.addEventListener("mousedown", onMouseDown, false);

        this.close = function(){
            cv.removeEventListener("mousedown", onMouseDown, false);
            setTrackingTarget(null); //release object tracker.
        };
    }
    ViewMode.title = "View/Tracking Mode";

    /**
     * class EditMode
     */
    function EditMode(space, conductor, view){
        this.view = view;
        var cv = view.getCanvas();

        var propWindows = [];
        
        function onMouseDown(e){
            var pos0 = Util.getMousePosOnElement(cv, e);

            var obj = view.getObjectAtPointOnCanvas(pos0);
            if(obj){
                openObjectPropertyWindow(obj, space);
                
                // start dragging object
                var oldObjX = Vector.getX(obj.position);
                var oldObjY = Vector.getY(obj.position);

                function onMouseMove(e){
                    var pos1 = Util.getMousePosOnElement(cv, e);
                    var newObjX = oldObjX +  (pos1[0] - pos0[0])/view.getScale();
                    var newObjY = oldObjY + -(pos1[1] - pos0[1])/view.getScale();
                    Vector.setXY(obj.position, newObjX, newObjY);
                    space.dispatchObjectChangedEvent();
                    view.invalidateAndClear();
                }
            
                function onMouseUp(e){
                    cv.removeEventListener("mousemove", onMouseMove, false);
                    cv.removeEventListener("mouseup", onMouseUp, true);
                }
                cv.addEventListener("mousemove", onMouseMove, false);
                cv.addEventListener("mouseup", onMouseUp, true);
            }
            else{
                view.beginMouseDragScroll(e);
            }
        }
        cv.addEventListener("mousedown", onMouseDown, true);

        this.close = function(){
            cv.removeEventListener("mousedown", onMouseDown, true);
            closeObjectPropertyWindowAll(space);
        };
    }
    EditMode.title = "Editing Mode";

    /**
     * class ObjectPropertyWindow
     */
    function ObjectPropertyWindow(){
        var captionDiv;
        var textboxMass;
        var textboxRadius;
        var textboxPositionX;
        var textboxPositionY;
        var textboxVelocityX;
        var textboxVelocityY;
        var textboxDirection;
        var textboxSpeed;
        var buttonApply;
        var buttonClose;
        var windowDiv = HTML.div({className: "window"}, [
            captionDiv = HTML.div({className: "window-caption"}, [
                HTML.text("Object Properties")
            ]),
            HTML.div(null, [
                HTML.text("Mass:"),
                textboxMass = HTML.textbox(),
                HTML.text("kg")
            ]),
            HTML.div(null, [
                HTML.text("Radius:"),
                textboxRadius = HTML.textbox(),
                HTML.text("m")
            ]),
            HTML.div(null, [
                HTML.text("Position:"),
                textboxPositionX = HTML.textbox(),
                HTML.text("m, "),
                textboxPositionY = HTML.textbox(),
                HTML.text("m")
            ]),
            HTML.div(null, [
                HTML.text("Velocity:"),
                textboxVelocityX = HTML.textbox(),
                HTML.text("m/s, "),
                textboxVelocityY = HTML.textbox(),
                HTML.text("m/s")
            ]),
            HTML.div(null, [
                HTML.text("Direction:"),
                textboxDirection = HTML.textbox(),
                HTML.text("deg")
            ]),
            HTML.div(null, [
                HTML.text("Speed:"),
                textboxSpeed = HTML.textbox(),
                HTML.text("m/s")
            ]),
            HTML.div(null, [
                buttonApply = HTML.button("Apply"),
                buttonClose = HTML.button("Close"),
            ]),
        ]);

        var controls = [
            {elem:textboxMass, gettor:function(o){return o.mass;}, settor:function(o, v){o.mass = v;}},
            {elem:textboxRadius, gettor:function(o){return o.radius;}, settor:function(o, v){o.radius = v;}},
            {elem:textboxPositionX, gettor:function(o){return Vector.getX(o.position);}, settor:function(o, v){Vector.setX(o.position, v);}},
            {elem:textboxPositionY, gettor:function(o){return Vector.getY(o.position);}, settor:function(o, v){Vector.setY(o.position, v);}},
            {elem:textboxVelocityX, gettor:function(o){return Vector.getX(o.velocity);}, settor:function(o, v){Vector.setX(o.velocity, v);}},
            {elem:textboxVelocityY, gettor:function(o){return Vector.getY(o.velocity);}, settor:function(o, v){Vector.setY(o.velocity, v);}},
            {elem:textboxDirection, gettor:function(o){return Math.atan2(Vector.getY(o.velocity), Vector.getX(o.velocity))/Math.PI*180;}, settor:function(o, v){v = v/180*Math.PI; Vector.mul(Vector.length(o.velocity), Vector.newXY(Math.cos(v), Math.sin(v)),  o.velocity);}},
            {elem:textboxSpeed, gettor:function(o){return Vector.length(o.velocity);}, settor:function(o, v){var speed = Vector.length(o.velocity); if(speed > 0){Vector.mul(v/speed, o.velocity, o.velocity);}}},
        ];
        function updateControls(){
            if(!targetObject){
                return;
            }
            for(var i = 0; i < controls.length; ++i){
                if(!controls[i].changed && i != currentFocusControlIndex){
                    var value = controls[i].gettor(targetObject);
                    if(isFinite(value)){
                        controls[i].elem.value = Math.abs(value) < 100000 ? value.toString() : value.toExponential();
                    }
                }
            }
        }
        function applyChanges(){
            if(!targetObject){
                return;
            }
            if(hasPropertyChanged){
                for(var i = 0; i < controls.length; ++i){
                    if(controls[i].changed){
                        var value = parseFloat(controls[i].elem.value);
                        if(isFinite(value)){
                            controls[i].settor(targetObject, value);
                        }
                    }
                }
                if(targetSpace){
                    targetSpace.dispatchObjectChangedEvent();
                }
                clearPropertyChangedAll();
            }
            updateControls();
        }
        function updateApplyButtonEnabled(){
            buttonApply.disabled = !hasPropertyChanged;
        }
        
        // プロパティ変更記録。
        var hasPropertyChanged = false;
        function setPropertyChanged(index){
            hasPropertyChanged = true;
            controls[index].changed = true;
            updateApplyButtonEnabled();
        }
        function clearPropertyChangedAll(){
            hasPropertyChanged = false;
            for(var i = 0; i < controls.length; ++i){
                controls[i].changed = false;
            }
            updateApplyButtonEnabled();
        }

        // フォーカスが当たったら更新を禁止する。
        // フォーカスが外れたときに値が変わっていれば、「適用」するまで更新を禁止する。
        var currentFocusControlIndex = -1;
        var currentFocusControlValue = 0;
        function changeCurrentFocus(newIndex){
            if(currentFocusControlIndex >= 0){
                var newValue = parseFloat(controls[currentFocusControlIndex].elem.value);
                if(isFinite(newValue) && newValue != currentFocusControlValue){
                    setPropertyChanged(currentFocusControlIndex);
                }
            }
            currentFocusControlIndex = newIndex;
            if(currentFocusControlIndex >= 0){
                currentFocusControlValue = targetObject ? controls[currentFocusControlIndex].gettor(targetObject) : 0;
            }
        }
        function observeControlChange(index){
            controls[index].elem.addEventListener("focus", function(e){
                changeCurrentFocus(index);
            }, false);
            controls[index].elem.addEventListener("blur", function(e){
                changeCurrentFocus(-1);
            }, false);
        }
        for(var i = 0; i < controls.length; ++i){
            observeControlChange(i);
        }

        // 空間と対象オブジェクト
        var targetObject = null;
        var targetSpace = null;
        function setSpace(space){
            if(targetSpace){
                targetSpace.removeEventListener("objectchanged", updateControls);
            }
            targetSpace = space;
            if(targetSpace){
                targetSpace.addEventListener("objectchanged", updateControls);
            }
        }
        function setObject(obj){
            if(targetObject){
                return;
            }
            targetObject = obj;
            clearPropertyChangedAll();
            updateControls();
        }

        // 閉じる
        function close(){
            setSpace(null);
            
            if(targetObject){
                var obj = targetObject;
                targetObject = null;
                closeObjectPropertyWindow(obj);
            }

            var parent = windowDiv.parentNode;
            if(parent){
                parent.removeChild(windowDiv);
            }
        }
        
        // public methods.
        
        this.getElement = function() { return windowDiv;};
        this.setSpace = setSpace;
        this.setObject = setObject;
        this.close = close;
        
        buttonClose.addEventListener("click", close, false);
        buttonApply.addEventListener("click", applyChanges, false);
        
        // ドラッグで移動できるようにする。
        var windowMove = createWindowDraggingOperationImpl(parent, windowDiv, captionDiv);
    }
    function openObjectPropertyWindow(obj, space){
        if(obj._propertyWindow){
            return; //already opened.
        }
        var propWin = new ObjectPropertyWindow();
        propWin.setSpace(space);
        propWin.setObject(obj);
        document.body.appendChild(propWin.getElement());
        obj._propertyWindow = propWin;
    }
    function closeObjectPropertyWindow(obj){
        if(obj){
            var w = obj._propertyWindow;
            if(w){
                delete obj._propertyWindow;
                w.close();
            }
        }
    }
    function closeObjectPropertyWindowAll(space){
        for(var i = 0; i < space.objects.length; ++i){
            closeObjectPropertyWindow(space.objects[i]);
        }
    }
    
    
    var MODES = [ViewMode, EditMode];
    

    function main() {
        var conductor = new Conductor();
        
        // create a canvas.
        var view = new View();
        conductor.setView(function(){view.invalidate();});
        var cv = view.getCanvas();
        document.body.appendChild(cv);

        // mode.
        var currentMode = null;
        function changeMode(modeIndex){
            if(currentMode){
                currentMode.close();
                currentMode = null;
            }
            if(modeIndex >= 0 && modeIndex < MODES.length){
                currentMode = new (MODES[modeIndex])(view.getSpace(), conductor, view);
            }
        }
        
        // create a control.
        var initStateSelect;
        var initButton;
        var startButton;
        var visibleAxisCheckbox;
        var enabledBlurCheckbox;
        var modeSelect;
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
            modeSelect = HTML.select(MODES.map(function(item){return HTML.text(item.title);})),
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
        modeSelect.addEventListener("change", function(e){
            changeMode(e.target.selectedIndex);
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
            changeMode(-1);// close current mode.
            
            var space = state.factory();
            conductor.setSpace(space);
            conductor.setTimeSlice(state.dt || DEFAULT_DT);
            view.setSpace(space);
            view.setScale(
                (state.scale !== undefined) ? 0.5*Math.min(cv.width, cv.height)*state.scale : DEFAULT_VIEW_SCALE);
            view.setCenterXY(
                state.viewX || DEFAULT_VIEW_X,
                state.viewY || DEFAULT_VIEW_Y);
            updateTextbox();

            changeMode(0);
        }

        initSpace(presetInitialStates[0]);
    }
    
    thispkg.App = {
        main: main
    };
})();
