// -*- coding: utf-8 -*-
// require MisoPackage.js
// require Utility.js
// require Vector.js
// require Space.js
// require SpaceView.js
// require Presets.js
//
// Copyright (c) 2010 AKIYAMA Kouhei
// Licensed under the MIT License.

(function(){
    var mypkg = Misohena.package("Misohena", "galaxysim");

    // imports
    var HTML = mypkg.HTML;
    var Util = mypkg.Util;
    var Vector = mypkg.Vector;
    var Vector2D = mypkg.Vector2D;
    var Space = mypkg.Space;
    var SpaceObject = mypkg.SpaceObject;
    var SpaceView = mypkg.SpaceView;
    var Presets = mypkg.Presets;

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
            if(!currStroke.dragging && Vector2D.distance(currStroke.downPos, currStroke.currPos) > DRAGGING_START_LENGTH){
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
                    stroke.downWindowPos = getElementAbsPos(windowDiv);
                },
                move: function(stroke){
                    var currWindowPos = Vector2D.add(
                        stroke.downWindowPos,
                        Vector2D.sub(
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
        };
        win.getCaptionElement = function(){
            return captionDiv;
        };
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
     * class ViewMode
     */
    function ViewMode(space, conductor, view){
        this.view = view;
        var cv = view.getCanvas();

        // add mouse event handlers.
        var mouseHandler = setMouseHandler(
            cv, {
                dragbegin: function(stroke){
                    view.beginMouseDragScroll(stroke.downEvent);
                },
                click: function(stroke){
                    // select tracking target by clicking.
                    var obj = view.getObjectAtPointOnCanvas(stroke.downPos, PICKING_RADIUS);
                    if(obj){
                        view.setTrackingTarget(obj);
                    }
                    else{
                        view.setTrackingTarget(null);
                    }
                }
            });

        this.close = function(){
            mouseHandler.release();
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
                var velArrowScale = stroke.downVelArrowScale;//et.getVelArrowScale();
                var tail = et.getVelArrowTail();

                var newVel2D = Vector2D.negateY(Vector2D.mul(1/velArrowScale, Vector2D.sub(stroke.currPos, tail)));
                if(Vector2D.isFinite(newVel2D)){
                    et.setVelocity(Vector.newXY(
                        Vector2D.getX(newVel2D),
                        Vector2D.getY(newVel2D) ));
                    space.dispatchObjectChangedEvent();
                    view.invalidateAndClear();
                }
            }
        }

        // Change Position by Mouse Dragging

        function beginDragPositionAndSelectObject(stroke){
            var obj = view.getObjectAtPointOnCanvas(stroke.downPos, PICKING_RADIUS);
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
                }//,
            });

        // Current Edit Target
        
        function EditTarget(obj){
            var velArrowScale = NaN;
            
            updateVelArrowScale();

            function getVelocity(){
                var tracked = view.getTrackingTarget();
                if(tracked){
                    return Vector.sub(obj.velocity, tracked.velocity);
                }
                else{
                    return Vector.newClone(obj.velocity);
                }
            }
            function setVelocity(v){
                var tracked = view.getTrackingTarget();
                if(tracked){
                    Vector.add(v, tracked.velocity,  obj.velocity);
                }
                else{
                    Vector.assign(v, obj.velocity);
                }
            }
            function updateVelArrowScaleInner(){
                var speed = Vector.length(getVelocity());
                velArrowScale = VEL_ARROW_LENGTH/speed; // NaN,INF,-INF
            }
            function updateVelArrowScale(){
                if(isFinite(velArrowScale)){
                    var speed = Vector.length(getVelocity());
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
                    return Vector2D.negateY(Vector2D.mul(velArrowScale, getVelocity()));
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
                setVelocity: setVelocity//,
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

        // public

        this.openObjectPropertyWindow = openObjectPropertyWindow;
        this.setEditTarget = setCurrentEditTarget;
        this.getSpace = function(){ return space;};
        this.getView = function(){ return view;};
        this.getConductor = function(){ return conductor;};
        this.close = function(){
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
                "Mass(kg): ", c.textboxMass = HTML.textbox()
            ]),
            HTML.div(null, [
                "Radius(m): ", c.textboxRadius = HTML.textbox()
            ]),
            HTML.div(null, [
                "Position(m): ",
                " X", c.textboxPositionX = HTML.textbox(),
                " Y", c.textboxPositionY = HTML.textbox()
            ]),
            HTML.div(null, [
                "Velocity(m/s): ",
                " X", c.textboxVelocityX = HTML.textbox(),
                " Y", c.textboxVelocityY = HTML.textbox(), HTML.br(),
                " Direction(deg): ", c.textboxDirection = HTML.textbox(), HTML.br(),
                " Speed(m/s): ", c.textboxSpeed = HTML.textbox()
            ]),
            HTML.div({className: "footer"}, [
                c.buttonApply = HTML.button("Apply"),
                c.buttonClose = HTML.button("Close")
            ])
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
                 if(speed > 0){Vector.mul(v/speed, o.velocity, o.velocity);}}}
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

                win.setCaptionText(targetObject.getName());

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
                editMode.getView().setTrackingTarget(targetObject);
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
            c.buttonSaveStateToJSON = HTML.button("Save State to JSON"),
            c.buttonLoadStateFromJSON = HTML.button("Load State from JSON")
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

        c.buttonSaveStateToJSON.addEventListener("click", function(e){
            var data = JSON.stringify({
                space: editMode.getSpace().getState(),
                dt: editMode.getConductor().getTimeSlice(),
                scale: editMode.getView().getScaleByCanvasSize(),
                viewX: editMode.getView().getCenterX(),
                viewY: editMode.getView().getCenterY(),
                viewBlur: editMode.getView().getEnabledBlur()
            });

            var now = new Date();
            var swin = new SavedStateWindow(
                "Saved State at "+now.getFullYear()+"-"+(now.getMonth()+1)+"-"+now.getDate()+" "+now.getHours()+":"+now.getMinutes()+":"+now.getSeconds(),
                getElementAbsPos(e.target), data);
            document.body.appendChild(swin.getElement());
        }, false);

        c.buttonLoadStateFromJSON.addEventListener("click", function(e){
            var swin = new SavedStateWindow(
                "Load State from JSON", getElementAbsPos(e.target), "");
            document.body.appendChild(swin.getElement());
        }, false);
    }
    EditModeWindow.open = function(editMode){
        var editWin = new EditModeWindow(editMode);
        document.body.appendChild(editWin.getElement());
        return editWin;
    };

    /**
     * class SavedStateWindow
     */
    function SavedStateWindow(caption, pos, data){
        var win = this;
        var c = {};
        Window.call(this, null, [
            c.data = HTML.textarea(data, {rows:4, cols:40}),
            HTML.div({className:"footer"}, [
                c.load = HTML.button("Load"),
                c.close = HTML.button("Close")
            ])
        ]);
        win.setCaptionText(caption);
        win.setPosition(Vector2D.getX(pos), Vector2D.getY(pos));
        document.body.appendChild(win.getElement());

        c.load.addEventListener("click", function(){
            try{
                mypkg.app.initSpace(JSON.parse(c.data.value));
            }
            catch(e){
                alert(e);
            }
        }, false);
        
        c.close.addEventListener("click", function(){
            win.removeFromParent();
        }, false);
    }
    
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
                c.selectTemplate = HTML.select(Presets.SCRIPT_TEMPLATES.map(function(t){return t.title;})),
                c.loadTemplate = HTML.button("Load")
            ]),
            c.code = HTML.textarea("", {rows:15, cols:60}),
            HTML.div({className:"footer"}, [
                c.run = HTML.button("Run"),
                c.close = HTML.button("Close")
            ])
        ]);

        c.close.addEventListener("click", function(){
            win.removeFromParent();
        }, false);
        c.run.addEventListener("click", function(){
            runScript(c.code.value);
        }, false);
        c.loadTemplate.addEventListener("click", function(){
            c.code.value = Presets.SCRIPT_TEMPLATES[c.selectTemplate.selectedIndex].code;
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
    
    
    var MODES = [ViewMode, EditMode];

    /**
     * class AppControlPanel
     */
    function AppControlPanel(app) {
        var c = {};
        var controlDiv = HTML.div({}, [
            c.initStateSelect = HTML.select(Presets.INITIAL_STATES.map(function(s) { return s.title;})),
            c.initButton = HTML.button("Init"),
            c.startButton = HTML.button("Start/Stop"),
            c.visibleAxisCheckbox = HTML.checkbox(app.getView().getVisibleAxis()),
            "Axis",
            c.visibleTrackCheckbox = HTML.checkbox(app.getView().getVisibleTrack()),
            "Track",
            c.relativePlottingCheckbox = HTML.checkbox(app.getView().getRelativePlotting()),
            "Relative",
            c.enabledBlurCheckbox = HTML.checkbox(app.getView().getEnabledBlur()),
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
            HTML.br(),
            c.collisionCheckbox = HTML.checkbox(),
            "Collision",
            c.trackRecordingCheckbox = HTML.checkbox(),
            "Record Track"
        ]);
        this.getElement = function() { return controlDiv;};

        c.initButton.addEventListener("click", function(e){
            app.getConductor().stop();
            app.initSpace(Presets.INITIAL_STATES[c.initStateSelect.selectedIndex]);
        }, false);
        c.startButton.addEventListener("click", function(e){
            app.getConductor().toggleStartStop();
        }, false);
        c.visibleAxisCheckbox.addEventListener("change", function(e){
            app.getView().setVisibleAxis(!app.getView().getVisibleAxis());
        }, false);
        c.visibleTrackCheckbox.addEventListener("change", function(e){
            app.getView().setVisibleTrack(!app.getView().getVisibleTrack());
        }, false);
        c.relativePlottingCheckbox.addEventListener("change", function(e){
            app.getView().setRelativePlotting(!app.getView().getRelativePlotting());
        }, false);
        c.enabledBlurCheckbox.addEventListener("change", function(e){
            app.getView().setEnabledBlur(!app.getView().getEnabledBlur());
        }, false);
        c.modeSelect.addEventListener("change", function(e){
            app.changeMode(e.target.selectedIndex);
        }, false);
        c.timesliceTextbox.addEventListener("change", function(e){
            app.getConductor().setTimeSlice(parseFloat(e.target.value));
        }, false);
        c.epsilonTextbox.addEventListener("change", function(e){
            app.getSpace().setEpsilon(parseFloat(e.target.value));
        }, false);
        c.thetaTextbox.addEventListener("change", function(e){
            app.getSpace().setTheta(parseFloat(e.target.value));
        }, false);
        c.collisionCheckbox.addEventListener("click", function(e){
            app.getSpace().setCollisionEnabled(e.target.checked);
        }, false);
        c.trackRecordingCheckbox.addEventListener("click", function(e){
            app.getSpace().setTrackRecordingEnabled(e.target.checked);
            c.visibleTrackCheckbox.disabled = !e.target.checked;
        }, false);

        this.updateControls = function(){
            c.visibleTrackCheckbox.checked = app.getView().getVisibleTrack();
            c.relativePlottingCheckbox.checked = app.getView().getRelativePlotting();
            c.enabledBlurCheckbox.checked = app.getView().getEnabledBlur();
            c.timesliceTextbox.value = app.getConductor().getTimeSlice();
            c.epsilonTextbox.value = app.getSpace().getEpsilon().toExponential();
            c.thetaTextbox.value = app.getSpace().getTheta();
            c.collisionCheckbox.checked = app.getSpace().getCollisionEnabled();
            c.trackRecordingCheckbox.checked = app.getSpace().getTrackRecordingEnabled();
            c.visibleTrackCheckbox.disabled = !c.trackRecordingCheckbox.checked;
        };
        this.selectMode = function(index){
            c.modeSelect.selectedIndex = index;
        };
    }
    
    /**
     * class App
     */
    function App() {
        // space
        var space = null;
        this.getSpace = function() { return space;};
        
        // conductor
        var conductor = new Conductor();
        this.getConductor = function() { return conductor;};

        // view
        var view = new SpaceView(CANVAS_WIDTH, CANVAS_HEIGHT);
        this.getView = function() { return view;};
        document.body.appendChild(view.getCanvas());

        // mode
        var currentMode = null;
        var changeMode = this.changeMode = function(modeIndex){
            if(currentMode){
                currentMode.close();
                currentMode = null;
            }
            if(modeIndex >= 0 && modeIndex < MODES.length){
                currentMode = new (MODES[modeIndex])(view.getSpace(), conductor, view);
            }
        };

        // control panel
        var controlPanel = new AppControlPanel(this); //assert(view && conductor)
        document.body.appendChild(controlPanel.getElement());

        // initialize
        var initSpace = this.initSpace = function(state){
            changeMode(-1);// close current mode. some modes depend on space object. 

            if(state.space){
                space = new Space();
                space.setState(state.space);
            }
            else{
                space = state.factory();
            }
            conductor.setSpace(space);
            conductor.setTimeSlice(state.dt || DEFAULT_DT);
            view.setSpace(space);
            view.setScale(
                (state.scale !== undefined) ? 0.5*Math.min(view.getCanvas().width, view.getCanvas().height)*state.scale : DEFAULT_VIEW_SCALE);
            view.setCenterXY(
                state.viewX || DEFAULT_VIEW_X,
                state.viewY || DEFAULT_VIEW_Y);
            view.setEnabledBlur(state.viewBlur === undefined ? true : state.viewBlur);
            view.setRelativePlotting(state.viewRelativePlotting === undefined ? false : state.viewRelativePlotting);
            view.setVisibleTrack(space.getTrackRecordingEnabled());
            
            controlPanel.updateControls();
            controlPanel.selectMode(0); // if selectedIndex!=0 then call changeMode(0);
            changeMode(0); // make sure change mode


            ///@todo EditModeに入ったときに設定すべきかも。しかし、EditModeを終わっても開きっぱなしにできるので、ここで設定する必要がある。EditModeを終わっても開きっぱなしにできるのは、書いたコードを失いにくくするため。理想を言えばアプリケーションのspace属性の変更を監視してScriptEditorWindowが自動的に設定を変えるべき。ただ、これだけのためにイベント通知機構を追加するのもね。
            ScriptEditorWindow.getGlobalWindow().setSpaceAndView(space, view);
        };

        initSpace(Presets.INITIAL_STATES[0]);

        // public methods

        this.setTimeSlice = function(dt){
            if(conductor){
                conductor.setTimeSlice(dt);
            }
            if(controlPanel){
                controlPanel.updateControls();
            }
        };
    }


    /**
     * function main
     */
    mypkg.main = function() {
        if(!mypkg.app){
            mypkg.app = new App();
        }
    };
    
})();
