// -*- coding: utf-8 -*-
(function(){
    var mypkg = Misohena.package("Misohena", "galaxysim");

    // -----------------------------------------------------------------------
    // * HTML Utilities
    // -----------------------------------------------------------------------

    var HTML = mypkg.HTML = {
        createElement: function(tagName, attrs, children){
            var elem = document.createElement(tagName);
            if(attrs){
                if(attrs["className"]){
                    elem.className = attrs["className"];
                    delete attrs["className"];
                }
                for(var key in attrs){
                    elem.setAttribute(key, attrs[key]);
                }
            }
            if(children){
                children.forEach(function(c){
                    if(c){
                        if(typeof c == "string"){
                            elem.appendChild(HTML.text(c));
                        }
                        else{
                            elem.appendChild(c);
                        }
                    }
                });
            }
            return elem;
        },
        text: function(text){
            return document.createTextNode(text);
        },
        div: function(attrs, children){
            return HTML.createElement("div", attrs, children);
        },
        textbox: function(text, attrs){
            return HTML.createElement("input", mergeObject({
                "type": "text",
                "value": text}, attrs));
        },
        textarea: function(text, attrs){
            var elem = HTML.createElement("textarea", attrs);
            if(text){
                elem.value = text;
            }
            return elem;
        },
        button: function(text, attrs){
            return HTML.createElement("input", mergeObject({
                "type": "button",
                "value": text}, attrs));
        },
        checkbox: function(checked, attrs){
            if(checked){
                return HTML.createElement("input", mergeObject({
                    "type": "checkbox",
                    "checked": "checked"}, attrs));
            }
            else{
                return HTML.createElement("input", mergeObject({
                    "type": "checkbox"}, attrs));
            }
        },
        select: function(options, attrs){
            return HTML.createElement("select", attrs, options.map(function(oc){
                return HTML.createElement("option", null, [oc]);
            }));
        },
        br: function(){
            return HTML.createElement("br", {});
        },
        table: function(attrs, rows){
            var children = rows.map(function(row){
                return (row instanceof Array) ? HTML.tr(null, row)
                    : row;
            });
            return HTML.createElement("table", attrs, children);
        },
        tr: function(attrs, cells){
            var children = cells.map(function(cell){
                return (cell instanceof Array) ? HTML.td(null, cell)
                    : (typeof cell == "string") ? HTML.td(null, [cell])
                    : cell;
            });
            return HTML.createElement("tr", attrs, children);
        },
        td: function(attrs, children){
            return HTML.createElement("td", attrs, children);
        }
    };

    
    // -----------------------------------------------------------------------
    // * JavaScript Utilities
    // -----------------------------------------------------------------------

    var Util = mypkg.Util = {};
    
    var removeDuplicationInArray = Util.removeDuplicationInArray = function(arr)
    {
        for(var i = arr.length-1; i >=0 ; --i){
            for(var j = i-1; j >= 0; --j){
                if(arr[i] === arr[j]){
                    arr.splice(i, 1);
                    break;
                }
            }
        }
    };
    
    var mergeObject = Util.mergeObject = function(a, b)
    {
        var c = {};
        var key;
        if(a){
            for(key in a){
                c[key] = a[key];
            }
        }
        if(b){
            for(key in b){
                c[key] = b[key];
            }
        }
        return c;
    };



    
    // -----------------------------------------------------------------------
    // * DOM Utilities
    // -----------------------------------------------------------------------

    /**
     * 要素の絶対座標を求めます。
     */
    var getElementAbsPos = Util.getElementAbsPos = function(elem, parent)
    {
        var x = 0;
        var y = 0;
        while(elem && elem.offsetLeft != null && elem.offsetTop != null){
            x += elem.offsetLeft;
            y += elem.offsetTop;
            elem = elem.offsetParent;
            if(elem === parent){
                break;
            }
        }

        return [x, y];
    };

    /**
     * マウスイベントの指定要素上での座標を求めます。
     */
    var getMousePosOnElement = Util.getMousePosOnElement = function(elem, ev)
    {
        if(!ev){ev = event;}
        if(elem.getBoundingClientRect){
            var bcr = elem.getBoundingClientRect();
            var x = ev.clientX - bcr.left;
            var y = ev.clientY - bcr.top;
            return [x, y];
        }
        else if(typeof(ev.pageX) == "number" && typeof(ev.pageY) == "number"){
            var pos = getElementAbsPos(elem);
            return [ev.pageX-pos[0], ev.pageY-pos[1]];
        }
        else{
            return [0, 0];
        }
    };

    /**
     * ウィンドウのクライアント領域のサイズを求めます。
     */
    var getWindowClientSize = Util.getWindowClientSize = function() {
        if(window.innerWidth){
            return [window.innerWidth,
                    window.innerHeight];
        }
        else if(document.documentElement && document.documentElement.clientWidth){
            return [ document.documentElement.clientWidth,
                     document.documentElement.clientHeight ];
        }
        else{
            return [ document.body.clientWidth,
                     document.body.clientHeight ];
        }
    };

    /**
     * user-styleを設定します。
     */
    function setUserSelect(elem, value) {
        elem.style.userSelect =
        elem.style.MozUserSelect =
        elem.style.KhtmlUserSelect = "none";///@todo opera, chrome, safari
    }



    /**
     * 配列で指定されたすべての要素をそれぞれの要素の親から取り外します。
     */
    var removeElementsFromParent = Util.removeElementsFromParent = function(elements) {
        for(var ei = 0; ei < elements.length; ++ei){
            var elem = elements[ei];
            if(elem && elem.parentNode){
                elem.parentNode.removeChild(elem);
            }
        }
    };

    /**
     * 配列で指定された全ての要素を指定された要素へ追加します。
     */
    var addElementsTo = Util.addElementsTo = function(parent, elements) {
        if(parent){
            for(var ei = 0; ei < elements.length; ++ei){
                var elem = elements[ei];
                if(elem){
                    parent.appendChild(elem);
                }
            }
        }
        return parent;
    };
    
})();
