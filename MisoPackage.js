// -*- coding: utf-8 -*-
//
// Copyright (c) 2010 AKIYAMA Kouhei
// Licensed under the MIT License.
(function(){
    function getGlobalObject(){
        return this;
    }
    function package(){
        var t = getGlobalObject();
        for(var i = 0; i < arguments.length; ++i){
            t = t[arguments[i]] || (t[arguments[i]]={});
        }
        return t;
    }
    var mypkg = package("Misohena");

    mypkg.package = package;
})();
