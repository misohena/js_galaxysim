// -----------------------------------------------------------------------
// JavaScript Extensions
// https://developer.mozilla.org/ja/New_in_JavaScript_1.6
// https://developer.mozilla.org/en/New_in_JavaScript_1.8
// -----------------------------------------------------------------------
(function(){

    // --------------------------------------
    // Array
    // --------------------------------------
    
    // https://developer.mozilla.org/ja/Core_JavaScript_1.5_Reference/Global_Objects/Array/indexOf
    if(!Array.prototype.indexOf){
        Array.prototype.indexOf = function(elt /*, from*/){
            var len = this.length;

            var from = Number(arguments[1]) || 0;
            from = (from < 0) ? Math.ceil(from) : Math.floor(from);
            if (from < 0){
                from += len;
            }

            for (; from < len; from++){
                if(from in this && this[from] === elt){
                    return from;
                }
            }
            return -1;
        };
    }

    // https://developer.mozilla.org/ja/Core_JavaScript_1.5_Reference/Global_Objects/Array/lastIndexOf
    if(!Array.prototype.lastIndexOf){
        Array.prototype.lastIndexOf = function(elt /*, from*/){
            var len = this.length;

            var from = Number(arguments[1]);
            if (isNaN(from)){
                from = len - 1;
            }
            else{
                from = (from < 0)
                    ? Math.ceil(from)
                    : Math.floor(from);
                if (from < 0)
                    from += len;
                else if (from >= len)
                    from = len - 1;
            }

            for (; from > -1; from--){
                if (from in this &&
                    this[from] === elt)
                    return from;
            }
            return -1;
        };
    }

    // https://developer.mozilla.org/ja/Core_JavaScript_1.5_Reference/Global_Objects/Array/every
    if(!Array.prototype.every){
        Array.prototype.every = function(fun /*, thisp*/){
            var len = this.length;
            if (typeof fun != "function")
                throw new TypeError();

            var thisp = arguments[1];
            for (var i = 0; i < len; i++){
                if (i in this &&
                    !fun.call(thisp, this[i], i, this))
                    return false;
            }

            return true;
        };
    }

    // https://developer.mozilla.org/ja/Core_JavaScript_1.5_Reference/Global_Objects/Array/filter
    if (!Array.prototype.filter){
        Array.prototype.filter = function(fun /*, thisp*/){
            var len = this.length;
            if (typeof fun != "function")
                throw new TypeError();

            var res = new Array();
            var thisp = arguments[1];
            for (var i = 0; i < len; i++){
                if (i in this){
                    var val = this[i]; // fun が this を 変化させた場合に備えて
                    if (fun.call(thisp, val, i, this))
                        res.push(val);
                }
            }

            return res;
        };
    }

    // https://developer.mozilla.org/ja/Core_JavaScript_1.5_Reference/Global_Objects/Array/forEach
    if (!Array.prototype.forEach)
    {
        Array.prototype.forEach = function(fun /*, thisp*/)
        {
            var len = this.length;
            if (typeof fun != "function")
                throw new TypeError();

            var thisp = arguments[1];
            for (var i = 0; i < len; i++)
            {
                if (i in this)
                    fun.call(thisp, this[i], i, this);
            }
        };
    }
    
    // https://developer.mozilla.org/ja/Core_JavaScript_1.5_Reference/Global_Objects/Array/map
    if (!Array.prototype.map){
        Array.prototype.map = function(fun /*, thisp*/){
            var len = this.length;
            if (typeof fun != "function")
                throw new TypeError();

            var res = new Array(len);
            var thisp = arguments[1];
            for (var i = 0; i < len; i++){
                if (i in this){
                    res[i] = fun.call(thisp, this[i], i, this);
                }
            }
            return res;
        };
    }

    // https://developer.mozilla.org/ja/Core_JavaScript_1.5_Reference/Global_Objects/Array/some
    if (!Array.prototype.some){
        Array.prototype.some = function(fun /*, thisp*/){
            var len = this.length;
            if (typeof fun != "function")
                throw new TypeError();

            var thisp = arguments[1];
            for (var i = 0; i < len; i++){
                if (i in this &&
                    fun.call(thisp, this[i], i, this))
                    return true;
            }

            return false;
        };
    }

    // https://developer.mozilla.org/ja/Core_JavaScript_1.5_Reference/Objects/Array/reduce
    if (!Array.prototype.reduce){
        Array.prototype.reduce = function(fun /*, initial*/){
            var len = this.length;
            if (typeof fun != "function")
                throw new TypeError();

            // 初期値がない場合と空配列の場合は値を返さない
            if (len == 0 && arguments.length == 1)
                throw new TypeError();

            var i = 0;
            if (arguments.length >= 2){
                var rv = arguments[1];
            }
            else{
                do{
                    if (i in this){
                        rv = this[i++];
                        break;
                    }

                    // 配列が値を含まない場合、初期値を返さない
                    if (++i >= len)
                        throw new TypeError();
                } while (true);
            }

            for (; i < len; i++){
                if (i in this)
                    rv = fun.call(null, rv, this[i], i, this);
            }

            return rv;
        };
    }



})();
