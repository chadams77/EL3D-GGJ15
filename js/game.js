var GAME = GAME || {};

// Automatically resizes game area to full screen
// functions PX and PY convert world units to game units
// Where GH (game height) is always 100, and GW (game width) is always 100 * the aspect ratio

GAME.Init = function ( )
{
    // Load sfx
    var music = new buzz.sound('sfx/music', { formats: [ 'mp3', 'ogg' ]});
    var explosionSfx = new buzz.sound('sfx/explosion', { formats: [ 'mp3', 'ogg' ]});
    var launchSfx = new buzz.sound('sfx/launch', { formats: [ 'mp3', 'ogg' ]});
    var thrusterSfx = new buzz.sound('sfx/thruster', { formats: [ 'mp3', 'ogg' ]});
    var introSfx = new buzz.sound('sfx/intro', { formats: [ 'mp3', 'ogg' ]});
    var noSfx = new buzz.sound('sfx/no', { formats: [ 'mp3', 'ogg' ]});
    thrusterSfx.play().loop().setVolume(0);

    GAME.SW = $(window).width();
    GAME.SH = $(window).height();

    // Setup world
    // ---
    var world = GAME.world = new CANNON.World();
    world.broadphase = new CANNON.NaiveBroadphase();

    // Setup camera and scene
    // ---
    var NEAR = 0.1, FAR = 10000;

    var camera = GAME.camera = new THREE.PerspectiveCamera(90, GAME.SW / GAME.SH, NEAR, FAR );
    camera.up.set(0, 0, 1);
    camera.position.set(0, 0, 400);
    camera.lookAt(new THREE.Vector3(0, 0, 0));

    var scene = GAME.scene = new THREE.Scene();
    scene.fog = new THREE.Fog( 0x000000, 5000, FAR );

    var ambient = new THREE.AmbientLight( 0x404040 );
    scene.add( ambient );

    var light = new THREE.PointLight( 0xffffff );
    light.position.set( 300, 300, 40 );
    light.intensity = 1;
    //light.target.position.set( 0, 0, 0 );
    scene.add( light );

    var shiplight = new THREE.PointLight( 0x808080 );
    shiplight.position.set( 300, 300, 40 );
    shiplight.intensity = .4;
    shiplight.distance = 5000;
    //shiplight.target.position.set( 0, 0, 0 );
    /*shiplight.castShadow = false;

    shiplight.shadowCameraNear = 2;
    shiplight.shadowCameraFar = 5000;
    
    shiplight.shadowMapDarkness = 1.0;
    shiplight.shadowMapWidth = 512;
    shiplight.shadowMapHeight = 512;
    //shiplight.shadowCameraVisible = true;*/
    scene.add( shiplight );

    scene.add( camera );

    // SEtup renderer
    // ---
    renderer = new THREE.WebGLRenderer( { clearColor: 0x000000, clearAlpha: 1, antialias: false } );
    renderer.setSize( GAME.SW, GAME.SH );
    renderer.domElement.style.position = "relative";
    renderer.domElement.style.top = '0px';
    $(renderer.domElement).appendTo($(document.body));

    renderer.setClearColor( new THREE.Color(0x000000), 1 );
    renderer.autoClear = false;

    renderer.shadowMapEnabled = true;
    renderer.shadowMapSoft = true;
    renderer.shadowMapAutoUpdate = true;

    // Window resize callback
    // ---
    $(window).resize(function(){
        GAME.SW = $(window).width();
        GAME.SH = $(window).height();

        renderer.setSize( GAME.SW, GAME.SH );

        camera.aspect = GAME.SW / GAME.SH;
        camera.updateProjectionMatrix();
        camera.radius = ( GAME.SW + GAME.SH ) / 4;
    });

    // Animation & update
    // ---

    GAME.paused = false;
    var t = 0, newTime, delta, FRAME_DELTA = 1.0/60.0;

    var keys = {};

    function keyDownHandler(event)
    {
        var keyPressed = String.fromCharCode(event.keyCode);
        keys[keyPressed] = true;
        event.preventDefault();
    }

    function keyUpHandler(event)
    {
        var keyPressed = String.fromCharCode(event.keyCode);
        keys[keyPressed] = false;
        event.preventDefault();
    }

    $(document.body).keydown(keyDownHandler);
    $(document.body).keyup(keyUpHandler);

    function animate(){
        requestAnimationFrame( animate );
        if (allPrt)
            for (var i=0; i<allPrt.length; i++)
                if (allPrt[i].update(FRAME_DELTA) === false)
                {
                    allPrt.splice(i, 1);
                    i -= 1;
                    continue;
                }
        if(!GAME.paused){
            //updateVisuals();
            updatePhysics();
            gameUpdate(FRAME_DELTA);
        }
        render();
    }

    var lastCallTime = 0;
    function updatePhysics(){
        // Step world
        var timeStep = 1 / 60;

        var now = Date.now() / 1000;

        if(!lastCallTime){
            // last call time not saved, cant guess elapsed time. Take a simple step.
            world.step(timeStep);
            lastCallTime = now;
            return;
        }

        var timeSinceLastCall = now - lastCallTime;
        FRAME_DELTA = FRAME_DELTA * 0.0 + timeSinceLastCall * 1.0;

        world.step(timeStep, timeSinceLastCall, 3);

        lastCallTime = now;
    }

    function render(){
        renderer.clear();
        renderer.render( GAME.scene, camera );
    }

    var dustTexture = THREE.ImageUtils.loadTexture( 'img/dust.png' );
    for (var i=1; i<1500; i++)
    {
        var l = ~~(Math.random()*127+127);
        if (i===0)
            l = 255;
        var ballMaterial = new THREE.SpriteMaterial( { map: dustTexture, color: new THREE.Color((l << 16) | (l << 8) | l) } );
        var sprite = new THREE.Sprite( ballMaterial );
        sprite.fog = true;
        if (i===0)
            sprite.position.set( 0, 0, 0);
        else
            sprite.position.set( Math.random()*20000-10000, Math.random()*20000-10000, Math.random()*20000-10000 );
        if (i===0)
            sprite.scale.set( 500, 500, 1.0 );
        else
            sprite.scale.set( l/2, l/2, 1.0 );
        scene.add( sprite );
    }

    var PLANET_EARTH = 1;
    var PLANET_MARS  = 2;
    var PLANET_MOON  = 3;

    function Planet(p, radius, type, seed, detail){

        this.p = p;

        this.detail = detail ? detail : 7;
        this.radius = radius;
        var type = this.type = type ? type : PLANET_MOON;

        seed = this.seed = seed ? seed : 777;

        var noise = new ImprovedNoise().noise;
        var geometry = new THREE.IcosahedronGeometry( this.radius*2, this.detail );

        this.randomTarget = function()
        {
            var vec = new THREE.Vector3(Math.random()*2-1, Math.random()*2-1, Math.random()*2-1);
            this.getHM(vec);
            vec.add(this.p);
            return new Target(vec);
        };

        this.collideSphere = function(sp, sr)
        {
            var vec = new THREE.Vector3(sp.x-p.x, sp.y-p.y, sp.z-p.z);

            this.getHM(vec);

            var len = new THREE.Vector3(sp.x-p.x, sp.y-p.y, sp.z-p.z).length();
            if ((vec.length()+sr) > len)
                return true;
            else
                return false;
        };

        this.getHM = function(v)
        {
            v.setLength(1);
            var color = null;

            var ex = 0;

            for (k=0; k<10; k++)
            {
                var scale = Math.pow(1.7, k);
                var oscale = Math.pow(1.5, k);
                var nx = ~~((v.x+500+seed)*5000.0)/5000.0*scale;
                var ny = ~~((v.y+500+seed)*5000.0)/5000.0*scale;
                var nz = ~~((v.z+500+seed)*5000.0)/5000.0*scale;
                ex += Math.abs(noise(nx, ny, nz))*175*0.15/oscale;
            }

            ex = (ex / 0.4) * (ex / 0.4) * 0.0125 * 0.5;

            var noslur = false;

            if (ex<175*0.025 && type === PLANET_MARS)
            {
                ex = this.radius*0.075-(this.radius*0.025-ex)*3.0;
                color = new THREE.Color(0x261508);
            }
            else if (ex<175*0.075)
            {
                noslur = true;
                ex=this.radius*0.075;
                if (type === PLANET_EARTH)
                    color = new THREE.Color(0x004080);
                else if (type === PLANET_MARS)
                    color = new THREE.Color(0x483321);
                else if (type === PLANET_MOON)
                    color = new THREE.Color(0x484848);
            }
            else if (ex<175*0.125)
            {
                ex = (this.radius*0.1 + ex) * 0.5;
                if (type === PLANET_EARTH)
                    color = new THREE.Color(0x206000);
                else if (type === PLANET_MARS)
                    color = new THREE.Color(0x362518);
                else if (type === PLANET_MOON)
                    color = new THREE.Color(0x363636);
            }
            else if (ex<175*0.225)
            {
                if (type === PLANET_EARTH)
                    color = new THREE.Color(0x606060);
                else if (type === PLANET_MARS)
                    color = new THREE.Color(0x855e3d);
                else if (type === PLANET_MOON)
                    color = new THREE.Color(0x353535);
            }
            else
            {
                if (type === PLANET_MOON)
                    color = new THREE.Color(0x181818);
                else
                    color = new THREE.Color(0xd0d0d0);
            }

            if (type === PLANET_MOON)
                ex = -Math.pow(ex, 0.75);

            var r = color.r * 255;
            var g = color.g * 255;
            var b = color.b * 255;

            r += Math.random() * 16 - 8;
            g += Math.random() * 16 - 8;
            b += Math.random() * 16 - 8;
            r = Math.min(255, Math.max(0, ~~(r)));
            g = Math.min(255, Math.max(0, ~~(g)));
            b = Math.min(255, Math.max(0, ~~(b)));

            if (!noslur)
                color.setRGB(r/255, g/255, b/255);

            v.setLength(this.radius + ex);
            return [ v, color ];
        }

        var vertices = geometry.vertices
        var colors = [];

        for ( var i = 0, l = vertices.length; i < l; i ++ ) {

            var v = vertices[i];
            colors[i] = this.getHM(v)[1];
        }

        /*var physGeom = new THREE.IcosahedronGeometry( this.radius*2, 4 )
        var physVerts = [];
        var physFaces = [];

        for ( var i = 0, l = physGeom.vertices.length; i < l; i ++ ) {

            var v = physGeom.vertices[i];
            this.getHM(v);
            physVerts.push(new CANNON.Vec3(v.x, v.y, v.z));
        }*/

        var faceIndices = [ 'a', 'b', 'c', 'd' ];

        /*for (var i = 0; i < physGeom.faces.length; i ++)
        {
            var f = physGeom.faces[ i ];
            n = ( f instanceof THREE.Face3 ) ? 3 : 4;

            var pf = [];

            for (var j = 0; j < n; j++)
            {
                var vertexIndex = f[ faceIndices[ j ] ];
                pf.push(vertexIndex);
            }

            physFaces.push(pf);
        }*/

        for (var i = 0; i < geometry.faces.length; i ++)
        {
            var f = geometry.faces[ i ];
            n = ( f instanceof THREE.Face3 ) ? 3 : 4;

            for (var j = 0; j < n; j++)
            {
                var vertexIndex = f[ faceIndices[ j ] ];
                f.vertexColors[j] = colors[vertexIndex];
            }
        }

        /*var plShape = this.shape = new CANNON.ConvexPolyhedron(physVerts, physFaces);
        var body = this.body = new CANNON.Body({ mass: 0 });
        body.addShape(plShape);
        body.addShape(new CANNON.Sphere(this.radius));
        body.position.set(p.x, p.y, p.z);
        world.add(body);*/

        geometry.verticesNeedUpdate = true;
        geometry.elementsNeedUpdate = true;
        geometry.morphTargetsNeedUpdate = true;
        geometry.uvsNeedUpdate = true;
        geometry.normalsNeedUpdate = true;
        geometry.colorsNeedUpdate = true;
        geometry.tangentsNeedUpdate = true;
        geometry.computeFaceNormals();
        geometry.computeVertexNormals();

        var mesh = new THREE.Mesh( geometry, this.material = new THREE.MeshPhongMaterial( { vertexColors: THREE.VertexColors, shininess: 1 }) );
        mesh.receiveShadow = true;
        scene.add( mesh );

        this.geometry = geometry;
        this.vertices = vertices;
        this.mesh = mesh;

        mesh.position.set(p.x, p.y, p.z);
        this.update = function(dt)
        {
            mesh.position.set(this.p.x, this.p.y, this.p.z);
        };

        for (var i=0; i<(~~(this.radius/20)); i++)
            this.randomTarget();
    };

    function Ship ( p )
    {
        var scale = .2;
        this.scale = scale;

        var geometry = new THREE.IcosahedronGeometry( scale, 2 );
        var material = new THREE.MeshPhongMaterial( {color: 0x88ffa0} );
        //material.transparent = true;
        var mesh = new THREE.Mesh( geometry, material );
        scene.add( mesh );

        this.sphere = {
            geometry: geometry,
            material: material,
            mesh: mesh
        };

        //mesh.castShadow = true;

        var smaterial = new THREE.SpriteMaterial( { map: dustTexture, color: new THREE.Color(0x000000), transparent: true } );
        smaterial.transparent = true;
        smaterial.opacity = 1.0;
        var smesh = new THREE.Sprite( smaterial );
        smesh.position.set(p.x, p.y, p.z);
        smesh.scale.set(5, 5, 1.0);
        scene.add( smesh );

        this.p = p;

        mesh.position.set(p.x, p.y, p.z);

        this.legs = [];

        for (var li=0; li<3; li++)
        {
            var lgeo = new THREE.CylinderGeometry( scale*.2, scale*.2, scale*3, 32 );
            var matrix1 = new THREE.Matrix4().makeRotationZ((li-1)/1.5*Math.PI/4);
            var matrix2 = new THREE.Matrix4().makeRotationY((li-1)*Math.PI/4);
            //var matrix21 = new THREE.Matrix4().makeRotationY(Math.PI/4);
            var matrix3 = new THREE.Matrix4().makeTranslation(0, scale*2, 0);
            lgeo.applyMatrix(matrix3);
            if (li===1)
                lgeo.applyMatrix(new THREE.Matrix4().makeRotationX(Math.PI/5));
            else
                lgeo.applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI/4));
            lgeo.applyMatrix(matrix1);
            lgeo.applyMatrix(matrix2);
            //lgeo.applyMatrix(matrix21);
            lgeo.verticesNeedUpdate = true;
            var lmat = new THREE.MeshPhongMaterial( {color: 0xd0d0d0} );
            //lmat.transparent = true;
            var cylinder = new THREE.Mesh( lgeo, lmat );
            cylinder.castShadow = true;
            mesh.add ( cylinder );
            this.legs.push({
                geometry: lgeo,
                mesh: mesh,
                material: lmat
            });
        }

        var sphereShape = this.sphereShape = new CANNON.Sphere(scale);
        var body = this.body = new CANNON.Body({ mass: 1 });
        body.addShape(sphereShape);
        body.position.set(p.x, p.y, p.z);
        body.collisionFilterMask = 1;
        body.collisionFilterGroup = 2;
        world.add(body);

        this.update = function(dt)
        {
            this.p.set(this.body.position.x, this.body.position.y, this.body.position.z);
            mesh.quaternion.set(this.body.quaternion.x, this.body.quaternion.y, this.body.quaternion.z, this.body.quaternion.w);
            mesh.position.set(this.p.x, this.p.y, this.p.z);

            if (atPlanet)
            {
                var vec = new THREE.Vector3(this.p.x - atPlanet.p.x, this.p.y - atPlanet.p.y, this.p.z - atPlanet.p.z);
                atPlanet.getHM(vec);
                var v2 = new THREE.Vector3(vec.x, vec.y, vec.z);
                v2.setLength(3);
                vec.add(v2);
                var dist = new THREE.Vector3(atPlanet.p.x + vec.x, atPlanet.p.y + vec.y, atPlanet.p.z + vec.z);
                dist.sub(this.p);
                dist = dist.length();
                smaterial.opacity = 1.0 / (dist/40.0+1.0);
                smesh.position.set(atPlanet.p.x + vec.x, atPlanet.p.y + vec.y, atPlanet.p.z + vec.z);
                smesh.updateMatrix();
                smesh.updateMatrixWorld();
            }
            else
            {
                smesh.position.set(planets[0].p.x, planets[0].p.y, planets[0].p.z);
                smesh.updateMatrix();
                smesh.updateMatrixWorld();
            }
        };
    }

    var allPrt = [];
    var planets;

    function explosion ( p, N, str )
    {
        for (var i=0; i<N; i++)
        {
            var r = Math.random()*str*2;
            var a1 = Math.random()*Math.PI*2.0;
            var a2 = Math.random()*Math.PI*2.0;
            var v = new THREE.Vector3(
                Math.cos(a1) * Math.sin(a2) * r,
                Math.sin(a1) * Math.sin(a2) * r,
                Math.cos(a2) * r
                );
            var pp = new THREE.Vector3(p.x, p.y, p.z);
            new Particle(pp, v, 3, 4);
        }

        var vec = new THREE.Vector3(p.x-camera.position.x, p.y-camera.position.y, p.z-camera.position.z);
        explosionSfx.play().setVolume(100/(vec.length()/50+1));
    }

    var targets = [];

    function Target ( p )
    {
        this.p = p;
        this.radius = 10;

        var geometry = new THREE.IcosahedronGeometry( this.radius, 1 );
        var material = new THREE.MeshPhongMaterial( {color: Math.random() < 0.5 ? 0xff0000 : 0x00ff00} );
        var mesh = new THREE.Mesh( geometry, material );
        mesh.position.set(p.x, p.y, p.z);
        scene.add( mesh );

        this.destroy = function()
        {
            score += 1000;
            explosion(this.p, 300, 40);
            scene.remove(mesh);
            noSfx.play();
        }

        targets.push(this);
    }

    function Bomb ( p, v )
    {
        launchSfx.play();

        this.p = p;
        this.v = v;
        this.radius = .25;
        this.t = 30.0;

        var sphereShape = this.sphereShape = new CANNON.Sphere(this.radius);
        var body = this.body = new CANNON.Body({ mass: 1 });
        body.addShape(sphereShape);
        body.position.set(p.x, p.y, p.z);
        body.velocity.set(v.x, v.y, v.z);
        body.collisionFilterMask = 1;
        body.collisionFilterGroup = 2;
        world.add(body);

        var ballMaterial = new THREE.SpriteMaterial( { map: dustTexture, color: new THREE.Color(0xff0000) } );
        var sprite = new THREE.Sprite( ballMaterial );
        sprite.scale.set( this.radius*5, this.radius*5, 1 );
        sprite.position.set( p.x, p.y, p.z );
        //scene.add(sprite);

        var slight = new THREE.PointLight( 0xff0000 );
        slight.position.set( p.x, p.y, p.z );
        slight.intensity = 5;
        slight.distance = 100;
        scene.add(slight);
        for (var i=0; i<planets.length; i++)
            planets[i].material.needsUpdate = true;
        ship.sphere.material.needsUpdate = true;
        for (var i=0; i<ship.legs.length; i++)
            ship.legs[i].material.needsUpdate = true;

        this.update = function(dt)
        {
            sprite.position.set(this.body.position.x, this.body.position.y, this.body.position.z);
            slight.position.set(this.body.position.x, this.body.position.y, this.body.position.z);

            for (var i=0; i<2; i++)
            {
                var d = Math.random() * dt;
                var prt = new Particle(new THREE.Vector3(this.body.position.x-this.body.velocity.x*d+Math.random()*0.25-0.125, this.body.position.y-this.body.velocity.y*d+Math.random()*0.25-0.125, this.body.position.z-this.body.velocity.z*d+Math.random()*0.25-0.125), new THREE.Vector3(this.body.velocity.x, this.body.velocity.y, this.body.velocity.z), 0.75);
            }

            this.t -= dt;

            for (var i=0; i<targets.length; i++)
            {
                var dist = new THREE.Vector3(this.body.position.x - targets[i].p.x, this.body.position.y - targets[i].p.y, this.body.position.z - targets[i].p.z).length();
                if (dist < (targets[i].radius+this.radius*5))
                {
                    world.remove(body);
                    //scene.remove(sprite);
                    scene.remove(slight);
                    for (var j=0; j<planets.length; j++)
                        planets[j].material.needsUpdate = true;
                    ship.sphere.material.needsUpdate = true;
                    for (var j=0; j<ship.legs.length; j++)
                        ship.legs[j].material.needsUpdate = true;                    

                    targets[i].destroy();
                    targets.splice(i, 1);
                    return null;
                }
            }

            for (var i=0; i<planets.length; i++)
                if (planets[i].collideSphere(new THREE.Vector3(this.body.position.x, this.body.position.y, this.body.position.z), this.radius) || this.t < 0)
                {
                    world.remove(body);
                    //scene.remove(sprite);
                    scene.remove(slight);
                    for (var i=0; i<planets.length; i++)
                        planets[i].material.needsUpdate = true;
                    ship.sphere.material.needsUpdate = true;
                    for (var i=0; i<ship.legs.length; i++)
                        ship.legs[i].material.needsUpdate = true;

                    explosion(new THREE.Vector3(this.body.position.x, this.body.position.y, this.body.position.z), 200, 15);
                    return null;
                }

            return this;
        }
    }

    function Particle ( p, v, t, sz )
    {
        this.p = new THREE.Vector3(p.x, p.y, p.z);
        v = this.v = v ? new THREE.Vector3(v.x, v.y, v.z) : new THREE.Vector3(0,0,0);
        var sz = this.sz = (sz ? sz : 0.5) * (Math.random() * 0.75 + 0.25) * 5.0;
        if (Math.random() < 0.25)
            this.clr = new THREE.Color(0xff0000);
        else if (Math.random() < 0.5)
            this.clr = new THREE.Color(0xffff00);
        else
            this.clr = new THREE.Color(0xd0d0d0);
        this.t = ((t ? t : 2.0) * (Math.random() * 0.5 + 0.5)) * 0.5;

        var ballMaterial = new THREE.SpriteMaterial( { map: dustTexture, color: this.clr, transparent: true } );
        ballMaterial.transparent = true;
        var sprite = new THREE.Sprite( ballMaterial );
        sprite.scale.set( sz, sz, 1 );
        sprite.position.set( p.x, p.y, p.z );
        
        scene.add( sprite );

        var sphereShape = this.sphereShape = new CANNON.Sphere(this.radius);
        var body = this.body = new CANNON.Body({ mass: 1 });
        body.addShape(sphereShape);
        body.position.set(p.x, p.y, p.z);
        body.velocity.set(v.x, v.y, v.z);
        body.collisionFilterMask = 1;
        body.collisionFilterGroup = 2;
        body.linearDamping = 0.0;
        world.add(body);

        this.update = function(dt)
        {
            this.t -= dt;

            p.x += (this.body.position.x - p.x) * dt * 12;
            p.y += (this.body.position.y - p.y) * dt * 12;
            p.z += (this.body.position.z - p.z) * dt * 12;

            sprite.position.set(p.x, p.y, p.z);
            var op = Math.min(1, this.t);
            sprite.scale.set( sz, sz, 1 );
            ballMaterial.opacity = op;
            sprite.updateMatrixWorld();

            if (this.t <= 0)
            {
                scene.remove(sprite);
                world.remove(body);
                return false;
            }

            return true;
        };

        allPrt.push(this);
    }

    // Initialize planets
    // ---

    planets = [ 
        new Planet(new THREE.Vector3(0, -2000, 0), 200, PLANET_EARTH, 13413*(Math.random()+0.5), 6),
        new Planet(new THREE.Vector3(800, -3000, 1000), 100, PLANET_MOON, 452*(Math.random()+1), 6),
        new Planet(new THREE.Vector3(-4000, 2000, -500), 150, PLANET_MARS, 13413*(Math.random()+0.5), 6)
    ];
    var ship = new Ship(new THREE.Vector3(0, 0, 0));
    var ctime = 0.0;

    var atPlanet = null;
    var dirLen = 20;
    var lookAt = new THREE.Vector3(ship.p.x, ship.p.y, ship.p.z);
    var camPos = new THREE.Vector3(ship.p.x, ship.p.y-1, ship.p.z);
    var camUp = new THREE.Vector3(0, 0, 1);
    var camDir = new THREE.Vector3(0, -1, 0);

    var bomb = null;

    var score = 0;
    var dispScore = 0;

    window.loadingDom.remove();

    function gameEnd(win){
        world.remove(ship.body);
        $('#score').text('Score: ' + Math.floor(score));
        var restartBtn = $('<div class="restartBtn">New Game</div>');
        restartBtn.click(function(){
            window.location.reload();
        });
        var res = win ? $('<div class="win">Success!</div>') : $('<div class="lose">Failure... What do we do now?</div>');
        var dom = $('<div id="gameover"></div>');
        res.appendTo(dom);
        restartBtn.appendTo(dom);
        dom.appendTo($(document.body));
        gameOver = true;
    }
    var gameOver = false;

    function gameUpdate(dt){

        if (Math.abs(score-dispScore) < 10)
            dispScore = score;
        dispScore += (score - dispScore) * dt * 0.5;
        $('#score').text('Score: ' + Math.floor(dispScore));
        //GAME.paused = true;
        ctime += dt;

        if (bomb)
            bomb = bomb.update(dt);

        if (!gameOver)
        {
            ship.update(dt);
            for (var i=0; i<planets.length; i++)
            if (planets[i].collideSphere(ship.p, ship.scale))
                {
                    thrusterSfx.setVolume(0);
                    explosion(ship.p, 150, 20);
                    gameEnd(false);
                    break;
                }
        }
        if (targets.length === 0 && !gameOver)
            gameEnd(true);

        shiplight.position.set(ship.p.x, ship.p.y, ship.p.z);

        /*var dir = new THREE.Vector3(0, -1, 0);
        dir.set(ship.body.position.x-0, ship.body.position.y - 0, ship.body.position.z - 0);
        dir.normalize();
        dir.multiplyScalar(-1);
        var p0 = new THREE.Vector3(ship.body.position.x, ship.body.position.y, ship.body.position.z);
        if (atPlanet)
        {
            p0.sub(atPlanet.p);
            atPlanet.getHM(p0);
            p0.add(atPlanet.p);
            dir.setLength(125);
        }
        else
        {
            //dir.normalize();
            //dir.applyQuaternion(ship.sphere.mesh.quaternion);
            dir.setLength(125);
        }*/
        /*if (atPlanet)
        {
            atPlanet.getHM(p0);
            dir.setLength(atPlanet.radius * 2.0);
        }*/

        /*var p1 = new THREE.Vector3(p0.x, p0.y, p0.z);
        p1.sub(dir);
        var p2 = new THREE.Vector3(p0.x, p0.y, p0.z);
        dir.setLength(50);
        p2.add(dir);

        shiplight.position.set(p1.x, p1.y, p1.z);
        shiplight.updateMatrix();
        shiplight.updateMatrixWorld();
        shiplight.target.position.set(p2.x, p2.y, p2.z);
        //shiplight.lookAt(new THREE.Vector3(lookAt.x-camPos.x, lookAt.y-camPos.y, lookAt.z-camPos.z));
        shiplight.target.updateMatrix();
        shiplight.target.updateMatrixWorld();*/

        var dir = new THREE.Vector3(0, -1, 0);
        dir.normalize();
        dir.applyQuaternion(ship.sphere.mesh.quaternion);

        var oldAtPlanet = atPlanet;
        atPlanet = null;

        for (var i=0; i<planets.length; i++)
        {
            if (planets[i].p.distanceTo(ship.p) < 1000)
            {
                dir.copy(planets[i].p);
                dir.sub(new THREE.Vector3(ship.body.position.x, ship.body.position.y, ship.body.position.z));
                dir.normalize();
                atPlanet = planets[i];
                break;
            }
        }

        if (atPlanet)
        {
            dirLen = atPlanet.p.distanceTo(ship.p) < atPlanet.radius*2.0 ? 15 : 10;
            dir.setLength(dirLen);
        }
        else
        {
            dirLen = 20;
            dir.setLength(dirLen);
        }

        var sp = 5.0;
        if (atPlanet)
            sp = 1.0;

        camDir.x += (dir.x - camDir.x) * Math.min(dt * sp, 1);
        camDir.y += (dir.y - camDir.y) * Math.min(dt * sp, 1);
        camDir.z += (dir.z - camDir.z) * Math.min(dt * sp, 1);

        var vec = new THREE.Vector3(0, 0, 1);
        vec.applyQuaternion(ship.sphere.mesh.quaternion);
        camUp.x += (vec.x - camUp.x) * Math.min(dt * sp, 1);
        camUp.y += (vec.y - camUp.y) * Math.min(dt * sp, 1);
        camUp.z += (vec.z - camUp.z) * Math.min(dt * sp, 1);
        camera.up.set(camUp.x, camUp.y, camUp.z);

        var p1 = new THREE.Vector3(ship.body.position.x, ship.body.position.y, ship.body.position.z);
        p1.sub(camDir);
        var p2 = new THREE.Vector3(ship.body.position.x, ship.body.position.y, ship.body.position.z);
        p2.add(camDir);
        camPos.x += (p1.x - camPos.x) * Math.min(dt * 5000, 1);
        camPos.y += (p1.y - camPos.y) * Math.min(dt * 5000, 1);
        camPos.z += (p1.z - camPos.z) * Math.min(dt * 5000, 1);
        camera.position.set(camPos.x, camPos.y, camPos.z);
        lookAt.x += (p2.x - lookAt.x) * Math.min(dt * 5000, 1);
        lookAt.y += (p2.y - lookAt.y) * Math.min(dt * 5000, 1);
        lookAt.z += (p2.z - lookAt.z) * Math.min(dt * 5000, 1);
        var vec = new THREE.Vector3();
        vec.copy(lookAt);
        camera.lookAt(vec);

        camera.updateMatrix();
        camera.updateMatrixWorld();

        var rot = null;
        if (!gameOver)
        {
            if (keys['A'])
                rot = new THREE.Vector3(0, 0, .07);
            if (keys['D'])
                rot = new THREE.Vector3(0, 0, -.07);
            if (keys['W'])
                rot = new THREE.Vector3(-.07, 0, 0);
            if (keys['S'])
                rot = new THREE.Vector3(.07, 0, 0);
        }
        if (atPlanet && rot)
            rot.multiplyScalar(2.0);
        if (rot)
            rot.multiplyScalar(0.5);
        if (keys[String.fromCharCode(38)] && !gameOver)
        {
            thrusterSfx.setVolume(50);
            var vel = new CANNON.Vec3(0, -20, 0);
            if (atPlanet)
                vel.y *= 1.5;
            
            ship.body.quaternion.vmult(new CANNON.Vec3(vel.x, vel.y, vel.z), vel);
            ship.body.applyForce(vel, ship.body.position);

            Math.seedrandom(ctime);
            for (var i=0; i<5; i++)
            {
                var a = Math.random() * Math.PI * 2;
                var vel = new CANNON.Vec3(Math.cos(a)*0, -10, Math.sin(a)*0);
                ship.body.quaternion.vmult(new CANNON.Vec3(vel.x, vel.y, vel.z), vel);
                var off = new CANNON.Vec3(0, .5, 0);
                ship.body.quaternion.vmult(new CANNON.Vec3(off.x, off.y, off.z), off);
                var d = Math.random() * dt;
                var prt = new Particle(new THREE.Vector3(ship.body.position.x+Math.random()*.25-.125+off.x-ship.body.velocity.x*d, ship.body.position.y+Math.random()*.25-.125+off.y-ship.body.velocity.y*d, ship.body.position.z+Math.random()*.5-.25+off.z-ship.body.velocity.z*d), new THREE.Vector3(-vel.x*0.2+ship.body.velocity.x, -vel.y*0.2+ship.body.velocity.y, -vel.z*0.2+ship.body.velocity.z), 0.25);
            }
        }
        else
            thrusterSfx.setVolume(0);
        if (keys[' '] && !bomb && atPlanet && !gameOver)
        {
            var off = new CANNON.Vec3(0, .5, 0);
            ship.body.quaternion.vmult(new CANNON.Vec3(off.x, off.y, off.z), off);
            bomb = new Bomb(new THREE.Vector3(ship.body.position.x+off.x, ship.body.position.y+off.y, ship.body.position.z+off.z), new THREE.Vector3(ship.body.velocity.x, ship.body.velocity.y, ship.body.velocity.z));
        }

        if (rot)
        {
            var nv = new CANNON.Vec3(0,0,0);
            ship.body.quaternion.vmult(new CANNON.Vec3(rot.x, rot.y, rot.z), nv);
            ship.body.angularVelocity.vadd(nv, ship.body.angularVelocity);
        }
        var nv = new CANNON.Vec3(0,0,0);
        ship.body.angularVelocity.mult(FRAME_DELTA*2, nv);
        ship.body.angularVelocity.vsub(nv, ship.body.angularVelocity);

        for (var i=0; i<planets.length; i++)
        {
            planets[i].update(dt);
            var delta = new CANNON.Vec3(planets[i].p.x, planets[i].p.y, planets[i].p.z);
            delta = delta.vsub(ship.body.position);
            var force = 1.5 * Math.min(10, .175 * Math.PI * Math.pow(planets[i].radius/2, 3.0) / delta.dot(delta));
            delta.normalize();
            delta = delta.mult(force);
            ship.body.applyForce(delta, ship.body.position);
            if (bomb)
            {
                var delta = new CANNON.Vec3(planets[i].p.x, planets[i].p.y, planets[i].p.z);
                delta = delta.vsub(bomb.body.position);
                var force = 15.0 * Math.min(10, .175 * Math.PI * Math.pow(planets[i].radius/2, 3.0) / delta.dot(delta));
                delta.normalize();
                delta = delta.mult(force);
                bomb.body.applyForce(delta, bomb.body.position);                
            }
        }

        //GAME.paused = false;
    };

    $(document.body).keyup(function(e){
        if (e.which === 32 && bomb && bomb.t < 20)
            bomb.t = 0;
    });

    // Start music
    music.play().loop();
    introSfx.play();

    // Start
    // ---

    requestAnimationFrame(animate);
};