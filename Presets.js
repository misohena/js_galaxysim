// -*- coding: utf-8 -*-
// require Vector.js
// require Space.js
//
// Copyright (c) 2010 AKIYAMA Kouhei
// Licensed under the MIT License.

(function(){
    var mypkg = Misohena.package("Misohena", "galaxysim");

    // imports
    var Vector = mypkg.Vector;
    var Space = mypkg.Space;
    var SpaceObject = mypkg.SpaceObject;

    var Presets = mypkg.Presets = {};
    
    //
    // Initial States
    //

    Presets.INITIAL_STATES = [
        // title, space, factory, dt, scale, viewX, viewY, viewBlur, viewRelativePlotting,
        
        {title:"Pseudo Solar System", space: {
            time:0,
            objects:[
                {name:"Sun", mass:1.9891e30,radius:696000000,pos:[0,0],vel:[0,0]},
                {name:"Mercury", mass:3.302e23,radius:2439700,pos:[57910000000,0],vel:[0,47872.5]},
                {name:"Venus", mass:4.8685e24,radius:6051800,pos:[108208930000,0],vel:[0,35021.4]},
                {name:"Earth", mass:5.9736e24,radius:6371000,pos:[149597870000,0],vel:[0,29780]},
                {name:"Mars", mass:6.4185e23,radius:3390000,pos:[227936640000,0],vel:[0,24130.9]},
                {name:"Jupiter", mass:1.8986e27,radius:69911000,pos:[778412010000,0],vel:[0,13069.7]},
                {name:"Saturn", mass:5.6846e26,radius:58232000,pos:[1426725400000,0],vel:[0,9672.4]},
                {name:"Moon", mass:7.35e+22,radius:1737100,pos:[149982270000,0],vel:[0,30802]}
            ],eps:100,theta:0.70,collisionEnabled:true, trackRecordingEnabled:true
        }, scale:5e-13, dt:21600, viewBlur:false},
        
        {title:"Earth to Venus",
         factory:function(){
             var space = new Space();
             space.setState({
                 time:0,
                 objects:[
                     {name:"Sun", mass:1.9891e30,radius:696000000,pos:[0,0],vel:[0,0]},
                     {name:"Mercury", mass:3.302e23,radius:2439700,pos:[57910000000,0],vel:[0,47872.5]},
                     //{name:"Venus", mass:4.8685e24,radius:6051800,pos:[108208930000,0],vel:[0,35021.4]},
                     {name:"Venus", mass:4.8685e+24,radius:6051800,pos:[-21766139319.885067,-105913014616.0789],vel:[34329.37399060615,-7059.195792284943]},
                     {name:"Earth", mass:5.9736e24,radius:6371000,pos:[149597870000,0],vel:[0,29780]},
                     {name:"Mars", mass:6.4185e23,radius:3390000,pos:[227936640000,0],vel:[0,24130.9]},
                     {name:"Jupiter", mass:1.8986e27,radius:69911000,pos:[778412010000,0],vel:[0,13069.7]},
                     {name:"Saturn", mass:5.6846e26,radius:58232000,pos:[1426725400000,0],vel:[0,9672.4]},
                     {name:"Probe", mass:500,radius:3,pos:[149597870000,-6371000-2000],vel:[6410,29780-4200]}
                 ],eps:1,theta:0.70,collisionEnabled:true, trackRecordingEnabled: true
             });
             var phase = 0;
             space.addEventListener("step", function(e){
                 switch(phase){
                 case 0:
                     if(space.time > 170*24*60*60){
                         mypkg.app.setTimeSlice(1800);
                         mypkg.app.getView().setTrackingTarget(space.findObjectByName("Venus"));
                         mypkg.app.getView().setScaleByCanvasSize(1e-10);
                         ++phase;
                     }
                     break;
                 case 1:
                     if(space.time > 188*24*60*60){
                         mypkg.app.setTimeSlice(180);
                         mypkg.app.getView().setTrackingTarget(space.findObjectByName("Venus"));
                         mypkg.app.getView().setScaleByCanvasSize(1e-9);
                         ++phase;
                     }
                     break;
                 }
             });
             return space;
         },
         scale:5e-12, dt:3600, viewBlur:false},

        
        {title:"Test Collision", factory:function(){
            var space = new Space();
            space.addObject(new SpaceObject(1e28, 6e8, Vector.newXY(-1e11, -1e11), Vector.newXY(29780, 29780)));
            space.addObject(new SpaceObject(1e28, 6e8, Vector.newXY(1e11, -1e11), Vector.newXY(-29780, 29780)));
            return space;
        }},

        
        {title:"Gravity Assisted Acc", factory:function(){
            var space = new Space();
            space.setTrackRecordingEnabled(true);
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
        }, dt:3600*0.5, scale:2e-11, viewBlur: false},

        
        {title:"Two Bodies Same Mass", factory:function(){
            var space = new Space();
            space.setTrackRecordingEnabled(true);
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
        }, viewBlur: false},

        
        {title:"Random 50(No Collision)", factory:function(){
            var space = new Space();
            space.setCollisionEnabled(false);
            for(var i = 0; i < 50; ++i){
                var radius = 7e7;
                var mass = radius*radius*radius*2000;
                var pos = Vector.randomInCircle(1e9);
                var vx = 0;
                var vy = 0;
                space.addObject(new SpaceObject(mass, radius, pos,
                                                Vector.newXY(vx, vy)));
            }
            return space;
        }, scale:5e-10},

        
        {title:"Random 100", factory:function(){
            var space = new Space();
            for(var i = 0; i < 100; ++i){
                var radius = 7e7;
                var mass = radius*radius*radius*5536;
                var pos = Vector.randomInCircle(8e10);
                var vx = 0;
                var vy = 0;
                space.addObject(new SpaceObject(mass, radius, pos,
                                                Vector.newXY(vx, vy)));
            }
            return space;
        }},

        
        {title:"Random 1000", factory:function(){
            var space = new Space();
            for(var i = 0; i < 1000; ++i){
                var radius = 7e7;
                var mass = radius*radius*radius*5536;
                var pos = Vector.randomInCircle(8e10);
                var vx = 0;
                var vy = 0;
                space.addObject(new SpaceObject(
                    mass, radius,
                    pos,
                    Vector.newXY(vx, vy)
                ));
            }
            return space;
        }},

        
        {title:"Random 1000(No Collision)", factory:function(){
            var space = new Space();
            space.setCollisionEnabled(false);
            for(var i = 0; i < 1000; ++i){
                var radius = 7e7;
                var mass = radius*radius*radius*5536;
                var pos = Vector.randomInCircle(8e10);
                var vx = 0;
                var vy = 0;
                space.addObject(new SpaceObject(
                    mass, radius,
                    pos,
                    Vector.newXY(vx, vy)
                ));
            }
            return space;
        }, viewBlur:false},

        
        {title:"Expand Stars", factory:function(){
            var space = new Space();
            space.setCollisionEnabled(false);
            for(var i = 0; i < 1000; ++i){
                var radius = 1e6 + 1e8*Math.random();
                var density = 100 + 2000*Math.random();
                var mass = Math.PI*4/3*(radius*radius*radius) * density;
                var pos = Vector.randomInCircle(1e10);
                var dist = Vector.length(pos);
                var speed = dist/50000;
                var dir = Vector.rot90(Vector.mul(1/dist, pos));
                var vel = Vector.mul(speed, dir);
                space.addObject(new SpaceObject(mass, radius, pos, vel));
            }
            return space;
        }, viewBlur:false, scale:2e-11, dt:1800},

        
        {title:"Empty(for Editing Mode)", factory:function(){return new Space();}},
    ];


    //
    // ScriptEditorWindow Templates
    //
    Presets.SCRIPT_TEMPLATES = [
        {title: "Empty", code: ""},
        
        {title: "Random Add",
         code:
         "var Vector = Misohena.galaxysim.Vector;\n"+
         "var SpaceObject = Misohena.galaxysim.SpaceObject;\n"+
         "\n"+
         "for(var i = 0; i < 100; ++i){\n"+
         "  var radius = 1e6 + 1e8*Math.random();\n"+
         "  var density = 700 + 5000*Math.random();\n"+
         "  var mass = Math.PI*4/3*(radius*radius*radius) * density;\n"+
         "  var pos = Vector.randomInCircle(1e11);\n"+
         "  var vel = Vector.randomInCircle(10000);\n"+
         "\n"+
         "  space.addObject(new SpaceObject(mass, radius, pos, vel));\n"+
         "}\n"+
         "// Name    Mass(kg)  Radius(m) Density(kg/m^3)\n"+
         "// Sun     1.9891e30 696000000 1409\n"+
         "// Mercury 3.302e23    2439700 5430\n"+
         "// Venus   4.8685e24   6051800 5240\n"+
         "// Earth   5.9736e24   6371000 5515\n"+
         "// Mars    6.4185e23   3390000 3940\n"+
         "// Jupiter 1.8986e27  69911000 1330\n"+
         "// Saturn  5.6846e26  58232000  700\n"+
         "// Uranus  8.6832e25  25362000 1300\n"+
         "// Neptune 1.0243e26  24622000 1760\n"+
         "// Pluto   1.3105e22   1153000 2000\n"+
         "// Moon    7.35e22     1737100 3346.4\n"
        },
        
        {title: "Random Add With Rotation",
         code:
         "var Vector = Misohena.galaxysim.Vector;\n"+
         "var SpaceObject = Misohena.galaxysim.SpaceObject;\n"+
         "\n"+
         "for(var i = 0; i < 100; ++i){\n"+
         "  var radius = 1e6 + 1e8*Math.random();\n"+
         "  var density = 700 + 5000*Math.random();\n"+
         "  var mass = Math.PI*4/3*(radius*radius*radius) * density;\n"+
         "  var pos = Vector.randomInCircle(1e11);\n"+
         "  var dist = Vector.length(pos);\n"+
         "  var speed = dist*0.0000004;\n"+
         "  var dir = Vector.rot90(Vector.mul(1/dist, pos));\n"+
         "  var vel = Vector.mul(speed, dir);\n"+
         "\n"+
         "  space.addObject(new SpaceObject(mass, radius, pos, vel));\n"+
         "}\n"
        },
        
        {title: "Lunar Orbit Injection",
         code:
         "var Vector = Misohena.galaxysim.Vector;\n"+
         "var Space = Misohena.galaxysim.Space;\n"+
         "var SpaceObject = Misohena.galaxysim.SpaceObject;\n"+
         "\n"+
         "Misohena.galaxysim.app.initSpace({\n"+
         "    factory: function(){\n"+
         "        var space = new Space();\n"+
         "        space.setTrackRecordingEnabled(true);\n"+
         "        space.setEpsilon(1);\n"+
         "        space.setState({\n"+
         "            objects:[\n"+
         "                {name:\"Earth\", mass:5.9736e24,radius:6371000,pos:[0,0],vel:[0,0]},\n"+
         "                {name:\"Moon\", mass:7.35e+22,radius:1737100,pos:[384400000,0],vel:[0,1022]},\n"+
         "                {name:\"Probe\", mass:50000,radius:5,pos:[6371000,0],vel:[9000,4310]}\n"+
         "            ],\n"+
         "            eps:1,\n"+
         "            dt:300});\n"+
         "        \n"+
         "        var probe = space.findObjectByName(\"Probe\");\n"+
         "\n"+
         "        var phase = 0;\n"+
         "        space.addEventListener(\"step\", function(e){\n"+
         "            switch(phase){\n"+
         "            case 0:\n"+
         "                // Time Slice Change\n"+
         "                if(space.time > (3*24+0)*60*60){\n"+
         "                    Misohena.galaxysim.app.setTimeSlice(60);\n"+
         "                    ++phase;\n"+
         "                }\n"+
         "                break;\n"+
         "            case 1:\n"+
         "                // Lunar Orbit Injection\n"+
         "                if(space.time > ((3*24+3)*60+30)*60){\n"+
         "                    var speed = Vector.length(probe.velocity);\n"+
         "                    var dir = Vector.mul(1.0/speed, probe.velocity);\n"+
         "                    var deltaV = -500;\n"+
         "                    Vector.addMul(probe.velocity, deltaV, dir,\n"+
         "                                  probe.velocity);\n"+
         "                    ++phase;\n"+
         "                }\n"+
         "                break;\n"+
         "            }\n"+
         "        });\n"+
         "        \n"+
         "        return space;\n"+
         "    },\n"+
         "    viewBlur:false,\n"+
         "    dt:300,\n"+
         "    scale:1e-9,\n"+
         "});\n"+
         "\n"
        },
    ];
    
})();
