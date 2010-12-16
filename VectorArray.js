// -*- coding: utf-8 -*-
(function(){
    var mypkg = Misohena.package("Misohena", "galaxysim");
    
    /**
     * Vector Math Utilities (2D & Array)
     */
    var Vector = mypkg.Vector2D = mypkg.Vector2DArray = mypkg.Vector = {
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

        dot: function(a, b){
            return a[0]*b[0]+a[1]*b[1];
        },
        perpdot: function(a, b){
            return a[0] * b[1] - a[1] * b[0];
        },
        
        // unary operator (return a vector value)
        
        negateY: function(v, dst){
            if(dst){
                dst[0] =  v[0];
                dst[1] = -v[1];
            }
            else{
                return [v[0], -v[1]];
            }
        },
        rot90: function(v, dst){
            if(dst){
                var vx = v[0];
                dst[0] = -v[1];
                dst[1] = vx;
            }
            else{
                return [-v[1], v[0]];
            }
        },
        rot180: function(v, dst){
            if(dst){
                dst[0] = -v[0];
                dst[1] = -v[1];
            }
            else{
                return [-v[0], -v[1]];
            }
        },
        rot270: function(v, dst){
            if(dst){
                var vx = v[0];
                dst[0] = v[1];
                dst[1] = -vx;
            }
            else{
                return [v[1], -v[0]];
            }
        },
        
        // unary operator (return a scalar value)
        
        lengthSq: function(v) { return v[0]*v[0] + v[1]*v[1];},
        length: function(v) { return Math.sqrt(v[0]*v[0] + v[1]*v[1]);},
        lengthLinf: function(v) { return Math.max(Math.abs(v[0]), Math.abs(v[1]));},
        isFinite: function(v) { return isFinite(v[0]) && isFinite(v[1]);},

        // setter
        
        setZero: function(v) { v[0] = v[1] = 0;},
        setXY: function(v, x, y) { v[0] = x; v[1] = y;},
        setX: function(v, x) { v[0] = x;},
        setY: function(v, y) { v[1] = y;},

        // getter
        
        getX: function(v) { return v[0];},
        getY: function(v) { return v[1];},

        // random
        randomInCircle: function(radius, dst){
            if(radius === undefined){ radius = 1;}

            var rr = radius * Math.sqrt(Math.random());
            var th = 2*Math.PI*Math.random();
            var x = rr*Math.cos(th);
            var y = rr*Math.sin(th);

            if(dst){
                dst[0] = x;
                dst[1] = y;
            }
            else{
                return [x, y];
            }
        },
    };
})();
