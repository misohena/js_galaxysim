// -*- coding: utf-8 -*-
// require MisoPackage.js
// require Utility.js
// require Vector.js
// require Space.js

// TODO: 同じ座標の物体が複数あると、ツリーの構築が終わらない問題を解決する。
// TODO: プリセット空間に空の空間を追加する。
// TODO: 現在の状態をテキストに出力できるようにする。
// TODO: jsonテキストから状態を復元できるようにする。
// TODO: 現在の状態をクッキーに出力できるようにする。
// TODO: View下のコントロールを枠で囲む。
// TODO: 衝突判定の有無を切り替えられるようにする。
// TODO: jsファイルを分割する。シミュレーションのコア部分をspace.jsへ。プリセット状態はpresets.jsへ。
// TODO: EditModeでも物体の追跡ができるようにする。ObjectPropertyWindowに追跡ボタンをつける。というか、ObjectPropertyWindowはObjectEditWindowまたはObjectWindowに改名すべき？　追跡中は速度ベクトルドラッグ時に、追跡対象物体に対する相対速度計算が必要になるので注意。
// TODO: index.htmlを書く。
// TODO: 公開する。

(function(){
    var thispkg = Misohena.package("Misohena", "galaxysim");

    // imports
    var HTML = thispkg.HTML;
    var Util = thispkg.Util;
    var Vector = thispkg.Vector;
    var Vector2D = thispkg.Vector2D;
    var Vector2DArray = thispkg.Vector2DArray;
    var Space = thispkg.Space;
    var SpaceObject = thispkg.SpaceObject;

    // Constants
    var CANVAS_WIDTH = 480;
    var CANVAS_HEIGHT = 480;
    
    var DEFAULT_DT = 3600;
    var DEFAULT_VIEW_SCALE = (CANVAS_WIDTH/2/2.0e11);
    var DEFAULT_VIEW_X = 0;
    var DEFAULT_VIEW_Y = 0;

    var DRAGGING_START_LENGTH = 3;
    var PICKING_RADIUS = 4;

    var VEL_ARROW_LENGTH = 50; //[px]
    var VEL_ARROW_LENGTH_MIN = VEL_ARROW_LENGTH/4;
    var VEL_ARROW_LENGTH_MAX = VEL_ARROW_LENGTH*4;

    var VEL_ARROW_HEAD_ARROW_LENGTH = 8;
    var VEL_ARROW_HEAD_ARROW_WIDTH = 8;
    
    //
    // Utilities
    //

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

    function getMousePosOnElement(elem, ev){
        var pos = Util.getMousePosOnElement(elem, ev);
        // convert Array to Vector2D
        return Vector2D.newXY(pos[0], pos[1]);
    }

    function getElementAbsPos(elem, parent){
        var pos = Util.getElementAbsPos(elem, parent);
        // convert Array to Vector2D
        return Vector2D.newXY(pos[0], pos[1]);
    }
    
    /**
     * 指定した要素上のマウスイベントハンドラを登録します。
     * @param elem 監視対象の要素です。
     * @param funcs マウスイベントハンドラを格納したオブジェクトです。
     *              有効なキーは
     *              down, move, up, dragbegin, dragmove, dragend, click, abort
     *              です。
     * @param elemMouseDown mousedownイベントを監視する要素です。
     *                      省略時はelemと同じです。
     * @return .release()を呼ぶと登録を解除するオブジェクト。
     */
    function setMouseHandler(elem, funcs, elemMouseDown)
    {
        if(!elemMouseDown){ elemMouseDown = elem;}
        
        var currStroke = null;

        function fcall(key){
            var f = funcs[key];
            if(f){ f(currStroke); }
        }

        function beginStroke(e0, pos0){
            if(currStroke){ endStroke();}
            
            elem.addEventListener("mousemove", onMouseMove, true);
            elem.addEventListener("mouseup", onMouseUp, true);
            currStroke = {
                downEvent: e0, downPos: pos0,
                currEvent: e0, currPos: pos0,
                //upEvent: undefined, upPos: undefined,
                dragging: false,
                endStroke: endStroke
            };
        }
        
        function endStroke(){
            if(currStroke){
                currStroke = null;
                elem.removeEventListener("mousemove", onMouseMove, true);
                elem.removeEventListener("mouseup", onMouseUp, true);
            }
        }
        
        function onMouseDown(e0){
            beginStroke(e0, getMousePosOnElement(elem, e0));
            fcall("down");
        }
        
        function onMouseMove(e1){
            if(!currStroke){
                return;
            }
            currStroke.currEvent = e1;
            currStroke.currPos = getMousePosOnElement(elem, e1);
            if(!currStroke.dragging && Vector2DArray.distance(currStroke.downPos, currStroke.currPos) > DRAGGING_START_LENGTH){
                // dragging starts.
                currStroke.dragging = true;
                fcall("dragbegin");
            }
            fcall("move");
            if(currStroke.dragging){
                fcall("dragmove");
            }
        }
        
        function onMouseUp(e2){
            if(!currStroke){
                return;
            }
            currStroke.upEvent = e2;
            currStroke.upPos = getMousePosOnElement(elem, e2);
            fcall("up");
            if(!currStroke.dragging){
                fcall("click");
            }
            else{
                fcall("dragend");
            }
            endStroke();
        }

        function abortCurrentStroke(){
            if(!currStroke){
                return;
            }
            fcall("abort");
            endStroke();
        }
        
        elemMouseDown.addEventListener("mousedown", onMouseDown, false);

        return {
            abortCurrentStroke: abortCurrentStroke,
            release: function(){
                abortCurrentStroke();
                elemMouseDown.removeEventListener("mousedown", onMouseDown, false);
            }
        };
    }

    /**
     * ウィンドウを動かすためのマウスイベントハンドラを登録します。
     */
    function setMoveWindowByMouse(parent, windowDiv, captionDiv)
    {
        return setMouseHandler(
            parent,
            {
                down: function(stroke){
                    stroke.downWindowPos = Util.getElementAbsPos(windowDiv);
                },
                move: function(stroke){
                    var currWindowPos = Vector2DArray.add(
                        stroke.downWindowPos,
                        Vector2DArray.sub(
                            stroke.currPos,
                            stroke.downPos));
                    setWindowPosition(windowDiv,
                                      currWindowPos[0],
                                      currWindowPos[1]);
                }
            },
            captionDiv
        );
    }

    function setWindowPosition(windowDiv, x, y)
    {
        windowDiv.style.left = x + "px";
        windowDiv.style.top  = y + "px";
    }

    function Window(attrs, children){
        var win = this;
        
        var captionDiv;
        var captionText;
        var clientDiv;
        var windowDiv = HTML.div(
            Util.mergeObject({"className": "window"}, attrs),
            [
                captionDiv = HTML.div({className: "window-caption"}, [
                    captionText = HTML.text("")
                ]),
                clientDiv = HTML.div({className: "window-client"}, children)
            ]
        );
        var windowMove = setMoveWindowByMouse(window, windowDiv, captionDiv);
        
        win.getElement = function(){
            return windowDiv;
        }
        win.getCaptionElement = function(){
            return captionDiv;
        }
        win.setCaptionText = function(str){
            captionText.nodeValue = str;
        };
        win.setPosition = function(x, y){
            setWindowPosition(windowDiv, x, y);
        };
        win.getPosition = function(){
            return getElementAbsPos(windowDiv, window.parentNode);
        };
        win.removeFromParent = function(){
            windowMove.abortCurrentStroke();
            var parent = windowDiv.parentNode;
            if(parent){
                parent.removeChild(windowDiv);
            }
        };
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

    var PRESET_INITIAL_STATES = [
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
    };
    Conductor.prototype = {
        getTimeSlice: function() { return this.dt;},
        getSpace: function() { return this.space;},
        
        setTimeSlice: function(dt){ if(isFinite(dt)){this.dt = dt;}},
        setSpace: function(space){ this.space = space;},
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
            }
        }
    };


    /**
     * class View
     */
    var View = function()
    {
        var view = this;
        this.center = Vector2D.newXY(DEFAULT_VIEW_X, DEFAULT_VIEW_Y);
        this.scale = DEFAULT_VIEW_SCALE;
        this.timerId = null;
        this.clearRequested = false;
        this.space = null;
        this.visibleAxis = false;
        this.enabledBlur = true;

        this.extraPainter = null;
        
        this.onSpaceObjectChanged = function(e){ view.invalidate();};
        
        // create a canvas
        var cv = document.createElement("canvas");
        cv.setAttribute("width", CANVAS_WIDTH);
        cv.setAttribute("height", CANVAS_HEIGHT);
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
                pos1 = getMousePosOnElement(cv, e);
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
            var pos0 = getMousePosOnElement(cv, e);
            var pos1 = pos0;
            cv.addEventListener("mousemove", moveMouseDragScroll, true);
            cv.addEventListener("mouseup", endMouseDragScroll, true);
        };
    };
    View.prototype = {
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
            var r = PICKING_RADIUS/this.getScale();
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
     * class ObjectTracker
     */
    function ObjectTracker(space, obj, view){
        // observe collision.
        var trackingTarget = null;
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
        function trackTarget(){
            if(trackingTarget){
                view.setCenterXYWithoutClear(
                    Vector.getX(trackingTarget.position),
                    Vector.getY(trackingTarget.position));
            }
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

        // add mouse event handlers.
        var mouseHandler = setMouseHandler(
            cv, {
                dragbegin: function(stroke){
                    view.beginMouseDragScroll(stroke.downEvent);
                },
                click: function(stroke){
                    // select tracking target by clicking.
                    var obj = view.getObjectAtPointOnCanvas(stroke.downPos);
                    if(obj){
                        setTrackingTarget(obj);
                    }
                    else{
                        setTrackingTarget(null);
                    }
                }
            });

        this.close = function(){
            mouseHandler.release();
            setTrackingTarget(null); //release object tracker.
        };
    }
    ViewMode.title = "View Mode";




    /**
     * class EditMode
     */
    function EditMode(space, conductor, view){
        var editMode = this;
        this.view = view;
        var cv = view.getCanvas();

        // Object Property Windows
        
        var objPropWindowY = 0;
        var OBJ_PROP_WINDOW_START_X = CANVAS_WIDTH + 20;
        var OBJ_PROP_WINDOW_START_Y = 100;
        var OBJ_PROP_WINDOW_STEP_Y = 24;
        var OBJ_PROP_WINDOW_COUNT_Y = 5;
        function openObjectPropertyWindow(obj){
            ObjectPropertyWindow.open(
                obj, space,
                OBJ_PROP_WINDOW_START_X,
                OBJ_PROP_WINDOW_START_Y+OBJ_PROP_WINDOW_STEP_Y*objPropWindowY,
                editMode);
            if(++objPropWindowY >= OBJ_PROP_WINDOW_COUNT_Y){
                objPropWindowY = 0;
            }
        }

        // Change Velocity by Mouse Dragging
        
        function beginDragVelocity(stroke){
            if(currentEditTarget && currentEditTarget.isPositionOnHeadArrow(stroke.downPos)){
                stroke.downVelArrowEditTarget = currentEditTarget;
                stroke.downVelArrowScale = currentEditTarget.getVelArrowScale();
                return true;
            }
            return false;
        }
        function dragVelocity(stroke){
            if(stroke.downVelArrowEditTarget){
                var et = stroke.downVelArrowEditTarget;
                var obj = et.getObject();
                var velArrowScale = stroke.downVelArrowScale;//et.getVelArrowScale();
                var tail = et.getVelArrowTail();

                var newVel2D = Vector2D.negateY(Vector2D.mul(1/velArrowScale, Vector2D.sub(stroke.currPos, tail)));
                if(Vector2D.isFinite(newVel2D)){
                    Vector.setXY(
                        obj.velocity,
                        Vector2D.getX(newVel2D),
                        Vector2D.getY(newVel2D) );
                    space.dispatchObjectChangedEvent();
                    view.invalidateAndClear();
                }
            }
        }

        // Change Position by Mouse Dragging

        function beginDragPositionAndSelectObject(stroke){
            var obj = view.getObjectAtPointOnCanvas(stroke.downPos);
            if(obj){
                stroke.downObj = obj;
                stroke.downObjX = Vector.getX(obj.position);
                stroke.downObjY = Vector.getY(obj.position);

                // select editing target & open property window
                setCurrentEditTarget(obj);
                openObjectPropertyWindow(obj);
                return true;
            }
            return false;
        }

        function dragPosition(stroke){
            if(stroke.downObj){
                var obj = stroke.downObj;
                var newX = stroke.downObjX +  (stroke.currPos[0] - stroke.downPos[0])/view.getScale();
                var newY = stroke.downObjY + -(stroke.currPos[1] - stroke.downPos[1])/view.getScale();
                Vector.setXY(obj.position, newX, newY);
                space.dispatchObjectChangedEvent();
                view.invalidateAndClear();
            }
        }
        
        
        var mouseHandler = setMouseHandler(
            cv, {
                down: function(stroke){
                    // drag head of velocity line.
                    if(beginDragVelocity(stroke)){
                        return;
                    }
                    // drag object.
                    if(beginDragPositionAndSelectObject(stroke)){
                        return;
                    }
                    // scroll.
                    view.beginMouseDragScroll(stroke.downEvent);
                    //stroke.endStroke();
                },
                dragmove: function(stroke){
                    // drag head of velocity line.
                    dragVelocity(stroke);
                    // drag object.
                    dragPosition(stroke);
                },
                click: function(stroke){
                    if(!stroke.downObj){
                        releaseCurrentEditTarget();
                    }
                },
            });

        // Current Edit Target
        
        function EditTarget(obj){
            var velArrowScale = NaN;
            
            updateVelArrowScale();
            
            function updateVelArrowScaleInner(){
                var speed = Vector.length(obj.velocity);
                velArrowScale = VEL_ARROW_LENGTH/speed; // NaN,INF,-INF
            }
            function updateVelArrowScale(){
                if(isFinite(velArrowScale)){
                    var speed = Vector.length(obj.velocity);
                    var velArrowPixels = speed*velArrowScale;
                    if(velArrowPixels > VEL_ARROW_LENGTH_MAX ||
                       velArrowPixels < VEL_ARROW_LENGTH_MIN){
                        updateVelArrowScaleInner();
                    }
                }
                else{
                    updateVelArrowScaleInner();
                }
            }
            function getVelArrowScale(){
                updateVelArrowScale();
                return isFinite(velArrowScale) ? velArrowScale : 1;
            }
            function getVelArrowVec(){
                updateVelArrowScale();
                if(isFinite(velArrowScale)){
                    return Vector2D.negateY(Vector2D.mul(velArrowScale, obj.velocity));
                }
                else{
                    return Vector2D.newXY(VEL_ARROW_LENGTH, 0);
                }
            }
            function getVelArrowTail(){
                return view.convertSpaceToCanvas(obj.position);
            }
            function getVelArrowHead(){
                return Vector2D.add(getVelArrowTail(), getVelArrowVec());
            }
            function isPositionOnHeadArrow(pos){
                var posRel = Vector2D.sub(pos, getVelArrowTail());
                var vec = getVelArrowVec();
                var vecLen = Vector2D.length(vec);
                var vecUnit = Vector2D.mul(1/vecLen, vec);

                var y = Vector2D.dot(vecUnit, posRel);
                var x = Vector2D.perpdot(vecUnit, posRel);
                return y <= vecLen
                    && y >= vecLen-VEL_ARROW_HEAD_ARROW_LENGTH
                    && Math.abs(x) < VEL_ARROW_HEAD_ARROW_WIDTH/2;
            }
            function drawVelArrow(){
                var ctx = view.getContext2D();
                ctx.strokeStyle = "#ff8000";
                ctx.fillStyle = "#ff8000";

                // position circle
                var tail = getVelArrowTail();
                var tailX = Vector2D.getX(tail);
                var tailY = Vector2D.getY(tail);
                ctx.beginPath();
                ctx.arc(tailX, tailY, 10, 0, 2*Math.PI, false);
                ctx.stroke();

                // velocity arrow
                var head = getVelArrowHead();
                var headX = Vector2D.getX(head);
                var headY = Vector2D.getY(head);
                ctx.beginPath();
                ctx.moveTo(tailX, tailY);
                ctx.lineTo(headX, headY);
                ctx.stroke();

                var vx = headX - tailX;
                var vy = headY - tailY;
                var vlen = Math.sqrt(vx*vx+vy*vy);
                var al = VEL_ARROW_HEAD_ARROW_LENGTH;
                var aw = VEL_ARROW_HEAD_ARROW_WIDTH/2;
                vx /= vlen;
                vy /= vlen;
                ctx.beginPath();
                ctx.moveTo(headX, headY);
                ctx.lineTo(headX-vx*al-vy*aw, headY-vy*al+vx*aw);
                ctx.lineTo(headX-vx*al+vy*aw, headY-vy*al-vx*aw);
                ctx.closePath();
                ctx.fill();
            }
            return {
                getVelArrowTail: getVelArrowTail,
                getVelArrowHead: getVelArrowHead,
                getVelArrowScale: getVelArrowScale,
                isPositionOnHeadArrow: isPositionOnHeadArrow,
                drawVelArrow: drawVelArrow,
                getObject: function() { return obj;},
            };
        }
        
        var currentEditTarget = null;
        function setCurrentEditTarget(obj){
            if(!obj || obj.isDestroyed()){
                releaseCurrentEditTarget();
                return;
            }

            if(currentEditTarget){
                releaseCurrentEditTarget();
            }

            currentEditTarget = new EditTarget(obj);
            view.setExtraPainter(currentEditTarget.drawVelArrow);

            currentEditTarget.getObject().addEventListener("removefromspace", onRemoveCurrentEditTarget);
            currentEditTarget.getObject().addEventListener("merged", onMergedCurrentEditTarget);
        }
        function releaseCurrentEditTarget(){
            if(currentEditTarget){
                currentEditTarget.getObject().removeEventListener("removefromspace", onRemoveCurrentEditTarget);
                currentEditTarget.getObject().removeEventListener("merged", onMergedCurrentEditTarget);
                currentEditTarget = null;
                view.setExtraPainter(null);
            }
        }
        function onRemoveCurrentEditTarget(e){
            if(currentEditTarget){
                releaseCurrentEditTarget();
            }
        }
        function onMergedCurrentEditTarget(e){
            if(currentEditTarget){
                setCurrentEditTarget(e.mergeTarget);
            }
        }

        // Edit Mode Menu
        var editWin = EditModeWindow.open(this);

        // tracking state.
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
        
        // public

        this.openObjectPropertyWindow = openObjectPropertyWindow;
        this.setEditTarget = setCurrentEditTarget;
        this.setTrackingTarget = setTrackingTarget;
        this.getSpace = function(){ return space;};
        this.getView = function(){ return view;};
        this.close = function(){
            setTrackingTarget(null); //release object tracker.
            releaseCurrentEditTarget();
            mouseHandler.release();
            ObjectPropertyWindow.closeAll(space);
            editWin.removeFromParent();
        };
    }
    EditMode.title = "Editing Mode";



    /**
     * class ObjectPropertyWindow
     */
    function ObjectPropertyWindow(){
        var win = this;
        // Window Contents
        var c = {};
        Window.call(this, null, [
            HTML.div(null, [
                "Mass(kg): ", c.textboxMass = HTML.textbox(),
            ]),
            HTML.div(null, [
                "Radius(m): ", c.textboxRadius = HTML.textbox(),
            ]),
            HTML.div(null, [
                "Position(m): ",
                " X", c.textboxPositionX = HTML.textbox(),
                " Y", c.textboxPositionY = HTML.textbox(),
            ]),
            HTML.div(null, [
                "Velocity(m/s): ",
                " X", c.textboxVelocityX = HTML.textbox(),
                " Y", c.textboxVelocityY = HTML.textbox(), HTML.br(),
                " Direction(deg): ", c.textboxDirection = HTML.textbox(), HTML.br(),
                " Speed(m/s): ", c.textboxSpeed = HTML.textbox(),
            ]),
            HTML.div({className: "footer"}, [
                c.buttonApply = HTML.button("Apply"),
                c.buttonClose = HTML.button("Close"),
            ]),
        ]);
        this.getCaptionElement().appendChild(HTML.div(null, [
            c.buttonDelete = HTML.button("Delete"),
            c.buttonSelect = HTML.button("Select"),
            c.buttonTrack = HTML.button("Track")
        ]));

        // Object Properties
        var properties = [
            {elem:c.textboxMass, gettor:function(o){return o.mass;}, settor:function(o, v){o.mass = v;}},
            {elem:c.textboxRadius, gettor:function(o){return o.radius;}, settor:function(o, v){o.radius = v;}},
            {elem:c.textboxPositionX, gettor:function(o){return Vector.getX(o.position);}, settor:function(o, v){Vector.setX(o.position, v);}},
            {elem:c.textboxPositionY, gettor:function(o){return Vector.getY(o.position);}, settor:function(o, v){Vector.setY(o.position, v);}},
            {elem:c.textboxVelocityX, gettor:function(o){return Vector.getX(o.velocity);}, settor:function(o, v){Vector.setX(o.velocity, v);}},
            {elem:c.textboxVelocityY, gettor:function(o){return Vector.getY(o.velocity);}, settor:function(o, v){Vector.setY(o.velocity, v);}},
            {elem:c.textboxDirection,
             gettor:function(o){
                 return Math.atan2(Vector.getY(o.velocity),
                                   Vector.getX(o.velocity))/Math.PI*180;},
             settor:function(o, v){
                 v = v/180*Math.PI;
                 Vector.mul(
                     Vector.length(o.velocity),
                     Vector.newXY(Math.cos(v), Math.sin(v)),
                     o.velocity);}},
            {elem:c.textboxSpeed,
             gettor:function(o){
                 return Vector.length(o.velocity);},
             settor:function(o, v){
                 var speed = Vector.length(o.velocity);
                 if(speed > 0){Vector.mul(v/speed, o.velocity, o.velocity);}}},
        ];
        function updateElements(){
            if(!targetObject){ return; }
            for(var i = 0; i < properties.length; ++i){
                if(!properties[i].changed && i != currentFocusControlIndex){
                    var value = properties[i].gettor(targetObject);
                    if(isFinite(value)){
                        properties[i].elem.value = Math.abs(value) < 100000 ? value.toString() : value.toExponential();
                    }
                }
            }
        }
        function applyChanges(){
            if(!targetObject){ return; }
            
            for(var i = 0; i < properties.length; ++i){
                if(properties[i].changed){
                    var value = parseFloat(properties[i].elem.value);
                    if(isFinite(value)){
                        properties[i].settor(targetObject, value);
                    }
                }
            }
            if(targetSpace){
                targetSpace.dispatchObjectChangedEvent();
            }
            clearPropertyChangedAll();
            updateElements();
        }
        function updateApplyButtonEnabled(){
            c.buttonApply.disabled = properties.every(function(prop){ return !prop.changed;});
        }
        
        function setPropertyChanged(index){
            properties[index].changed = true;
            updateApplyButtonEnabled();
        }
        function clearPropertyChangedAll(){
            for(var i = 0; i < properties.length; ++i){
                properties[i].changed = false;
            }
            updateApplyButtonEnabled();
        }

        // フォーカスが当たったら更新を禁止する。
        // フォーカスが外れたときに値が変わっていれば、「適用」するまで更新を禁止する。
        var currentFocusControlIndex = -1;
        var currentFocusControlValue = 0;
        function changeCurrentFocus(newIndex){
            if(currentFocusControlIndex >= 0){
                var newValue = parseFloat(properties[currentFocusControlIndex].elem.value);
                if(isFinite(newValue) && newValue != currentFocusControlValue){
                    setPropertyChanged(currentFocusControlIndex);
                }
            }
            currentFocusControlIndex = newIndex;
            if(currentFocusControlIndex >= 0){
                currentFocusControlValue = targetObject ? properties[currentFocusControlIndex].gettor(targetObject) : 0;
            }
        }
        function observeControlChange(index){
            properties[index].elem.addEventListener("focus", function(e){
                changeCurrentFocus(index);
            }, false);
            properties[index].elem.addEventListener("blur", function(e){
                changeCurrentFocus(-1);
            }, false);
        }
        for(var i = 0; i < properties.length; ++i){
            observeControlChange(i);
        }

        // link Space and Object
        var targetObject = null;
        var targetSpace = null;
        function setSpace(space){
            if(targetSpace){
                targetSpace.removeEventListener("objectchanged", updateElements);
            }
            targetSpace = space;
            if(targetSpace){
                targetSpace.addEventListener("objectchanged", updateElements);
            }
        }
        function setObject(obj){
            if(targetObject){
                targetObject.removeEventListener("merged", onObjectMerged);
                targetObject.removeEventListener("removefromspace", onObjectRemove);
            }
            targetObject = obj;
            if(targetObject){
                clearPropertyChangedAll();
                updateElements();

                win.setCaptionText("Object #"+targetObject.getId());

                targetObject.addEventListener("merged", onObjectMerged);
                targetObject.addEventListener("removefromspace", onObjectRemove);
            }
        }
        function onObjectMerged(e){
            var pos = win.getPosition();
            if(targetSpace){
                ObjectPropertyWindow.open(e.mergeTarget, targetSpace, Vector2D.getX(pos), Vector2D.getY(pos), editMode);
            }
        }
        function onObjectRemove(e){
            if(e.target === targetObject){
                close();
            }
        }

        // link EditMode
        var editMode = null;
        function setEditModeObject(em){
            editMode = em;
        }
        
        // Object Operations.
        
        function deleteObject(){
            if(targetSpace && targetObject){
                targetSpace.removeObject(targetObject);
                close();
            }
        }
        
        function selectObject(){
            if(targetSpace && targetObject && editMode){
                editMode.setEditTarget(targetObject);
            }
        }
        
        function trackObject(){
            if(targetSpace && targetObject && editMode){
                editMode.setTrackingTarget(targetObject);
            }
        }

        // buttons
        
        c.buttonDelete.addEventListener("click", deleteObject, false);
        c.buttonSelect.addEventListener("click", selectObject, false);
        c.buttonTrack.addEventListener("click", trackObject, false);
        
        c.buttonClose.addEventListener("click", close, false);
        c.buttonApply.addEventListener("click", applyChanges, false);
        
        // Window Operation.
        function close(){
            if(targetObject){
                var obj = targetObject;
                setObject(null);
                ObjectPropertyWindow.close(obj); //call this method recursive.
            }
            setSpace(null);
            
            win.removeFromParent();
        }

        // public methods.

        this.setEditModeObject = setEditModeObject;
        this.setSpace = setSpace;
        this.setObject = setObject;
        this.close = close;
        
    }
    ObjectPropertyWindow.open = function(obj, space, windowX, windowY, editMode){
        if(obj._propertyWindow){
            return; //already opened.
        }
        var propWin = new ObjectPropertyWindow();
        propWin.setEditModeObject(editMode);
        propWin.setPosition(windowX, windowY);
        propWin.setSpace(space);
        propWin.setObject(obj);
        document.body.appendChild(propWin.getElement());
        obj._propertyWindow = propWin;
    };
    ObjectPropertyWindow.close = function(obj){
        if(obj){
            var w = obj._propertyWindow;
            if(w){
                delete obj._propertyWindow;
                w.close();
            }
        }
    };
    ObjectPropertyWindow.closeAll = function(space){
        for(var i = 0; i < space.objects.length; ++i){
            ObjectPropertyWindow.close(space.objects[i]);
        }
    };



    /**
     * class EditModeWindow
     */
    function EditModeWindow(editMode) {
        var c = {};
        Window.call(this, null, [
            c.buttonAddObject = HTML.button("Add Object"),
            c.buttonScript = HTML.button("Script"),
        ]);
        this.setCaptionText("Edit Mode");

        c.buttonAddObject.addEventListener("click", function(){
            // add new object to space
            var newpos = editMode.getView().getCenter();
            var newobj = new SpaceObject(
                1000, 1000, Vector.newXY(Vector2D.getX(newpos), Vector2D.getY(newpos)));
            editMode.getSpace().addObject(newobj);
            // select object
            editMode.setEditTarget(newobj);
            editMode.openObjectPropertyWindow(newobj);
        }, false);

        c.buttonScript.addEventListener("click", function(){
            ScriptEditorWindow.openGlobal();
        }, false);
    }
    EditModeWindow.open = function(editMode){
        var editWin = new EditModeWindow(editMode);
        document.body.appendChild(editWin.getElement());
        return editWin;
    };

    /**
     * class ScriptEditorWindow
     */
    function ScriptEditorWindow(){
        var win = this;
        var space = null;
        var view = null;
        var c = {};
        Window.call(this, null, [
            HTML.div(null, [
                c.selectTemplate = HTML.select(ScriptEditorWindow.TEMPLATES.map(function(t){return t.title;})),
                c.loadTemplate = HTML.button("Load"),
            ]),
            c.code = HTML.textarea("", {rows:10, cols:50}),
            HTML.div({className:"footer"}, [
                c.run = HTML.button("Run"),
                c.close = HTML.button("Close"),
            ]),
        ]);

        c.close.addEventListener("click", function(){
            win.removeFromParent();
        }, false);
        c.run.addEventListener("click", function(){
            runScript(c.code.value);
        }, false);
        c.loadTemplate.addEventListener("click", function(){
            c.code.value = ScriptEditorWindow.TEMPLATES[c.selectTemplate.selectedIndex].code;
        }, false);

        function runScript(code){
            try{
                var func = new Function("space", code);
                func.call(this, space);
            }
            catch(e){
                alert(e);
            }
            view.invalidateAndClear();
        }

        this.setSpaceAndView = function(s, v){
            space = s;
            view = v;
        };
    }
    ScriptEditorWindow.globalWindow = null;
    ScriptEditorWindow.getGlobalWindow = function(){
        var SCRIPTEDITOR_X = CANVAS_WIDTH+20;
        var SCRIPTEDITOR_Y = 50;
        if(!ScriptEditorWindow.globalWindow){
            var win = ScriptEditorWindow.globalWindow = new ScriptEditorWindow();
            win.setPosition(SCRIPTEDITOR_X, SCRIPTEDITOR_Y);
            win.setCaptionText("Script Editor");
        }
        return ScriptEditorWindow.globalWindow;
    };
    ScriptEditorWindow.openGlobal = function(){
        document.body.appendChild(ScriptEditorWindow.getGlobalWindow().getElement());
    };
    ScriptEditorWindow.closeGlobal = function(){
        if(ScriptEditorWindow.globalWindow){
            ScriptEditorWindow.globalWindow.removeFromParent();
        }
    };
    ScriptEditorWindow.TEMPLATES = [
        {title: "Empty", code: ""},
        {title: "Random Add",
         code: "var Vector = Misohena.galaxysim.Vector;\n"+
               "var SpaceObject = Misohena.galaxysim.SpaceObject;\n"+
               "\n"+
               "for(var i = 0; i < 100; ++i){\n"+
               "  var mass = 1e20;\n"+
               "  var radius = 1000;\n"+
               "  var x = (2.0*Math.random()-1.0)*1e12;\n"+
               "  var y = (2.0*Math.random()-1.0)*1e12;\n"+
               "  var vx = (2.0*Math.random()-1.0)*10000;\n"+
               "  var vy = (2.0*Math.random()-1.0)*10000;\n"+
               "\n"+
               "  space.addObject(new SpaceObject(mass, radius, Vector.newXY(x, y), Vector.newXY(vx, vy)));\n"+
               "}\n"
        },
    ];
    
    
    var MODES = [ViewMode, EditMode];
    

    function main() {
        var conductor = new Conductor();
        
        // create a canvas.
        var view = new View();
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
        var c = {};
        var controlDiv = HTML.div({}, [
            c.initStateSelect = HTML.select(PRESET_INITIAL_STATES.map(function(s) { return s.title;})),
            c.initButton = HTML.button("Init"),
            c.startButton = HTML.button("Start/Stop"),
            c.visibleAxisCheckbox = HTML.checkbox(view.getVisibleAxis()),
            "Axis",
            c.enabledBlurCheckbox = HTML.checkbox(view.getEnabledBlur()),
            "Blur",
            c.modeSelect = HTML.select(MODES.map(function(item){return item.title;})),
            HTML.br(),
            "time slice:",
            c.timesliceTextbox = HTML.textbox(""),
            "second",
            HTML.br(),
            "epsilon:",
            c.epsilonTextbox = HTML.textbox(""),
            "meter (potential=G*m/sqrt(r^2+epsilon^2))",
            HTML.br(),
            "theta:",
            c.thetaTextbox = HTML.textbox(""),
        ]);
        document.body.appendChild(controlDiv);

        c.initButton.addEventListener("click", function(e){
            conductor.stop();
            initSpace(PRESET_INITIAL_STATES[c.initStateSelect.selectedIndex]);
        }, false);
        c.startButton.addEventListener("click", function(e){
            conductor.toggleStartStop();
        }, false);
        c.visibleAxisCheckbox.addEventListener("change", function(e){
            view.setVisibleAxis(!view.getVisibleAxis());
        }, false);
        c.enabledBlurCheckbox.addEventListener("change", function(e){
            view.setEnabledBlur(!view.getEnabledBlur());
        }, false);
        c.modeSelect.addEventListener("change", function(e){
            changeMode(e.target.selectedIndex);
        }, false);
        c.timesliceTextbox.addEventListener("change", function(e){
            conductor.setTimeSlice(parseFloat(e.target.value));
        }, false);
        c.epsilonTextbox.addEventListener("change", function(e){
            conductor.getSpace().setEpsilon(parseFloat(e.target.value));
        }, false);
        c.thetaTextbox.addEventListener("change", function(e){
            conductor.getSpace().setTheta(parseFloat(e.target.value));
        }, false);

        function updateTextbox(){
            c.timesliceTextbox.value = conductor.getTimeSlice();
            c.epsilonTextbox.value = conductor.getSpace().getEpsilon().toExponential();
            c.thetaTextbox.value = conductor.getSpace().getTheta();
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
            c.modeSelect.selectedIndex = 0;

            ///@todo EditModeに入ったときに設定すべきかも。しかし、EditModeを終わっても開きっぱなしにできるので、ここで設定する必要がある。EditModeを終わっても開きっぱなしにできるのは、書いたコードを失いにくくするため。理想を言えばアプリケーションのspace属性の変更を監視してScriptEditorWindowが自動的に設定を変えるべき。
            ScriptEditorWindow.getGlobalWindow().setSpaceAndView(space, view);
        }

        initSpace(PRESET_INITIAL_STATES[0]);
    }
    
    thispkg.App = {
        main: main
    };
})();
