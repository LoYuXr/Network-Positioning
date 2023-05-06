import * as THREE from 'three';
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
// graph:
    /*                                   [scene]                [cam2]
                    ________________________|________________________
                    |                       |                       |
                  [room]                 [agent]                 [light]
        ____________|____________       ____|____
        |       |       |       |       |       |
      [wall] [floor] [table]  [cam1]  [head]  [body]
    
    
    */


// global
const keyStates = { up: false, down: false, left: false, right: false };
const room_x = 7.7;
const room_z = 7.8;
const cam1_y = 4; //ceiling camera
const cam2_y = 5; //fixed camera, use orbitcontrols
const wall_y = 2.5;


function main() {
    const canvas = document.querySelector('#c');
    const renderer = new THREE.WebGLRenderer({canvas: canvas});
    //document.body.appendChild(renderer.domElement); //ask?
    renderer.setClearColor(0xffffff);
    renderer.shadowMap.enabled = true;

    const scene = new THREE.Scene();
    
    // lights
    {   
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);
        const light = new THREE.DirectionalLight(0xffffff, 0.5);
        light.position.set(room_x/2, 20, room_z/2);
        scene.add(light);
        light.castShadow = true;
        light.shadow.mapSize.width = 2048;
        light.shadow.mapSize.height = 2048;
    
        const d = 50;
        light.shadow.camera.left = -d;
        light.shadow.camera.right = d;
        light.shadow.camera.top = d;
        light.shadow.camera.bottom = -d;
        light.shadow.camera.near = 1;
        light.shadow.camera.far = 50;
        light.shadow.bias = 0.001;
    }

    // make camera functions:
    function makeCamera(fov = 40) {
        const aspect = canvas.clientWidth / canvas.clientHeight;  // the canvas default
        const zNear = 0.1;
        const zFar = 1000;
        return new THREE.PerspectiveCamera(fov, aspect, zNear, zFar);
    }

    //create room object3d:
    const room = new THREE.Object3D();
    scene.add(room);

    //in room object3d create floor:
    
    const floorGeometry = new THREE.BoxGeometry(room_x, 0.1, room_z); //box
    const floorMaterial = new THREE.MeshPhongMaterial({color: 0x868FAF});
    const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
    floorMesh.translateY(-0.1)
    floorMesh.receiveShadow = true;
    room.add(floorMesh);

    // in room object3d create four walls, clockwise:
    const Wall1Geometry = new THREE.BoxGeometry(room_x, wall_y, 0.1);
    const Wall1Material = new THREE.MeshPhongMaterial({color: 0xFEFAEE});
    const Wall1Mesh = new THREE.Mesh(Wall1Geometry, Wall1Material);
    Wall1Mesh.translateZ(-room_z / 2);
    Wall1Mesh.translateY(wall_y / 2-0.15)
    Wall1Mesh.receiveShadow = true;
    room.add(Wall1Mesh);

    const Wall2Geometry = new THREE.BoxGeometry(0.1, wall_y, room_z);
    const Wall2Material = new THREE.MeshPhongMaterial({color: 0xFEFAEE});
    const Wall2Mesh = new THREE.Mesh(Wall2Geometry, Wall2Material);
    Wall2Mesh.translateX(room_x / 2);
    Wall2Mesh.translateY(wall_y / 2-0.15)
    Wall2Mesh.receiveShadow = true;
    room.add(Wall2Mesh);

    const Wall3Geometry = new THREE.BoxGeometry(room_x, wall_y, 0.1);
    const Wall3Material = new THREE.MeshPhongMaterial({color: 0xFEFAEE});
    const Wall3Mesh = new THREE.Mesh(Wall3Geometry, Wall3Material);
    Wall3Mesh.translateZ(room_z / 2);
    Wall3Mesh.translateY(wall_y / 2-0.15)
    Wall3Mesh.receiveShadow = true;
    room.add(Wall3Mesh);

    const Wall4Geometry = new THREE.BoxGeometry(0.1, wall_y, room_z);
    const Wall4Material = new THREE.MeshPhongMaterial({color: 0xFEFAEE});
    const Wall4Mesh = new THREE.Mesh(Wall4Geometry, Wall4Material);
    Wall4Mesh.translateX(-room_x / 2);
    Wall4Mesh.translateY(wall_y / 2-0.15)
    Wall4Mesh.receiveShadow = true;
    room.add(Wall4Mesh);

    // in room object3d create three wifi signal source:
    // also add animation!

    const cyn1 = new THREE.CylinderGeometry(0.09, 0.09, 0.1, 64);
    const cyn2 = new THREE.CylinderGeometry(0.26, 0.26, 0.1, 64);
    const cyn3 = new THREE.CylinderGeometry(0.7, 0.7, 0.1, 64);
    
    const vertexShader = `
        varying vec3 vPosition;
        void main() {
            vPosition = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;

    const fragmentShader = `
        uniform vec3 color;
        varying vec3 vPosition;

        void main() {
            float alpha = 1.0 - vPosition.y / 0.05;
            gl_FragColor = vec4(color, alpha);
        }
    `;
    const clipplanes_wifi = [
        new THREE.Plane(new THREE.Vector3(0, 0, -1),-3.9),
        new THREE.Plane(new THREE.Vector3(0, 0, 1), 3.9),
        new THREE.Plane(new THREE.Vector3(1, 0, 0),3.85),
        new THREE.Plane(new THREE.Vector3(-1, 0, 0),-3.85),
	]

    const materials = [
    //圆柱侧面材
    new THREE.ShaderMaterial({
        uniforms: {
          color: { value: new THREE.Color(0xFFCC00) },
        },
        side: THREE.DoubleSide,
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        transparent: true,
        opacity: 0.5,
        clippingPlanes: clipplanes_wifi
    }),
    //圆柱顶材质
    new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
    }),
    //圆柱底材质
    new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide
    })
    ];
    materials.clippingPlanes = clipplanes_wifi;
    // wifi 1
    const wifi_1 = new THREE.Object3D();
    const wifi_1_cyn_1 = new THREE.Mesh(cyn1, materials);
    const wifi_1_cyn_2 = new THREE.Mesh(cyn2, materials);
    const wifi_1_cyn_3 = new THREE.Mesh(cyn3, materials);

    wifi_1.add(wifi_1_cyn_1);
    wifi_1.add(wifi_1_cyn_2);
    wifi_1.add(wifi_1_cyn_3);

    wifi_1.translateX(-3)
    wifi_1.translateZ(-2.25)

    scene.add(wifi_1);
    


    // wifi 2
    const wifi_2 = new THREE.Object3D();
    const wifi_2_cyn_1 = new THREE.Mesh(cyn1, materials);
    const wifi_2_cyn_2 = new THREE.Mesh(cyn2, materials);
    const wifi_2_cyn_3 = new THREE.Mesh(cyn3, materials);

    wifi_2.add(wifi_2_cyn_1);
    wifi_2.add(wifi_2_cyn_2);
    wifi_2.add(wifi_2_cyn_3);

    wifi_2.translateX(-2.91)
    wifi_2.translateZ(2.8)

    scene.add(wifi_2);
    

    // wifi 3
    const wifi_3 = new THREE.Object3D();
    const wifi_3_cyn_1 = new THREE.Mesh(cyn1, materials);
    const wifi_3_cyn_2 = new THREE.Mesh(cyn2, materials);
    const wifi_3_cyn_3 = new THREE.Mesh(cyn3, materials);

    wifi_3.add(wifi_3_cyn_1);
    wifi_3.add(wifi_3_cyn_2);
    wifi_3.add(wifi_3_cyn_3);

    wifi_3.translateX(3.39)
    wifi_3.translateZ(1.65)

    scene.add(wifi_3);

    //圆柱光圈扩散动画
    let cylinderRadius = 0;
    let cylinderOpacity= 0.5;
    function cylinderAnimate() {
        cylinderRadius += 0.01;
        cylinderOpacity-= 0.05;
        if (cylinderRadius > 2) {
            cylinderRadius = 0;
            cylinderOpacity= 0.5;
        }
        if (wifi_1_cyn_1 && wifi_1_cyn_2 && wifi_1_cyn_3) {
            wifi_1_cyn_1.scale.set(1 + cylinderRadius, 1, 1 + cylinderRadius);
            wifi_1_cyn_2.scale.set(1 + cylinderRadius, 1, 1 + cylinderRadius);
            wifi_1_cyn_3.scale.set(1 + cylinderRadius, 1, 1 + cylinderRadius);
            wifi_1_cyn_1.opacity = cylinderOpacity; //圆柱可见度减小
            wifi_1_cyn_2.opacity = cylinderOpacity; //圆柱可见度减小
            wifi_1_cyn_3.opacity = cylinderOpacity; //圆柱可见度减小
        }

        if (wifi_2_cyn_1 && wifi_2_cyn_2 && wifi_2_cyn_3) {
            wifi_2_cyn_1.scale.set(1 + cylinderRadius, 1, 1 + cylinderRadius);
            wifi_2_cyn_2.scale.set(1 + cylinderRadius, 1, 1 + cylinderRadius);
            wifi_2_cyn_3.scale.set(1 + cylinderRadius, 1, 1 + cylinderRadius);
            wifi_2_cyn_1.opacity = cylinderOpacity; //圆柱可见度减小
            wifi_2_cyn_2.opacity = cylinderOpacity; //圆柱可见度减小
            wifi_2_cyn_3.opacity = cylinderOpacity; //圆柱可见度减小
        }

        if (wifi_3_cyn_1 && wifi_3_cyn_2 && wifi_3_cyn_3) {
            wifi_3_cyn_1.scale.set(1 + cylinderRadius, 1, 1 + cylinderRadius);
            wifi_3_cyn_2.scale.set(1 + cylinderRadius, 1, 1 + cylinderRadius);
            wifi_3_cyn_3.scale.set(1 + cylinderRadius, 1, 1 + cylinderRadius);
            wifi_3_cyn_1.opacity = cylinderOpacity; //圆柱可见度减小
            wifi_3_cyn_2.opacity = cylinderOpacity; //圆柱可见度减小
            wifi_3_cyn_3.opacity = cylinderOpacity; //圆柱可见度减小
        }
    }


    //two cameras:
    // camera1 is fixed to the ceiling of the room (object3d object!)
    const camera1 = makeCamera();
    camera1.position.set(0, cam1_y, 0);
    camera1.lookAt(0, 0, 0)
    room.add(camera1)

    // camera 2 should use orbitcontrol to move this camera!
    const camera2 = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    //const camera2 = makeCamera();
    camera2.position.set(-room_x / 2 - 2, cam2_y, - room_z /2 - 2);
    scene.add(camera2)

    // 创建轨道控制器
    const controls = new OrbitControls(camera2, renderer.domElement);

    //create agent:
    const agent = new THREE.Object3D();

    const headGeometry = new THREE.SphereGeometry(0.2, 32, 32);
    const headMaterial = new THREE.MeshPhongMaterial({ color: 0x7A9DB3, receiveShadow: true });
    const headMesh = new THREE.Mesh(headGeometry, headMaterial);
    headMesh.position.y = 0.9;
    headMesh.castShadow = true;
    agent.add(headMesh);

    const bodyGeometry = new THREE.ConeGeometry(0.3, 1, 32);
    const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0x7A9DB3, receiveShadow: true });
    const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
     bodyMesh.translateY(-0.5)
    bodyMesh.castShadow = true;
    headMesh.add(bodyMesh);

    // agent.position.set(1, 0, 1);
    // 将 agent 对象添加到场景中
    scene.add(agent);


    const agentPosition = new THREE.Vector3(3, 0, 1);
    // Define arrow key codes
    const LEFT_ARROW = 37;
    const UP_ARROW = 38;
    const RIGHT_ARROW = 39;
    const DOWN_ARROW = 40;
    
    // Listen for keyboard events
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    function handleKeyDown(event) {
        switch (event.keyCode) {
            case UP_ARROW:
                keyStates.up = true; // Move agent up
                break;
            case DOWN_ARROW:
                keyStates.down = true;// Move agent down
                break;
            case LEFT_ARROW:
                keyStates.left = true;// Move agent left
                break;
            case RIGHT_ARROW:
                keyStates.right = true;// Move agent right
                break;
        }
    }

    function handleKeyUp(event) {
        switch (event.keyCode) {
            case UP_ARROW:
                keyStates.up = false;
                break;
            case DOWN_ARROW:
                keyStates.down = false;
                break; 
            case LEFT_ARROW:
                keyStates.left = false;
                break; 
            case RIGHT_ARROW:
                keyStates.right = false;
                break; 
        }
    }
    // RENDERER......
    
    function resizeRendererToDisplaySize(renderer) {
        const canvas = renderer.domElement;
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        const needResize = canvas.width !== width || canvas.height !== height;
        if (needResize) {
          renderer.setSize(width, height, false);
        }
        return needResize;
    }
    
    function render() {

        cylinderAnimate();

        if (resizeRendererToDisplaySize(renderer)){
            const canvas = renderer.domElement;
            camera1.aspect = canvas.clientWidth / canvas.clientHeight;
            camera1.updateProjectionMatrix();
            camera2.aspect = canvas.clientWidth / canvas.clientHeight;
            camera2.updateProjectionMatrix();
        }
        // Update agent position based on key state
        const speed = 0.03;
        if (keyStates.up) {
            agentPosition.x += speed;
        }
        if (keyStates.down) {
            agentPosition.x -= speed;
        }
        if (keyStates.left) {
            agentPosition.z -= speed;
        }
        if (keyStates.right) {
            agentPosition.z += speed;
        }

        //Clamp agent position to room boundaries
        const halfWidth = room_x / 2;
        const halfDepth = room_z / 2;
        agentPosition.x = THREE.MathUtils.clamp(agentPosition.x, -halfWidth, halfWidth);
        agentPosition.z = THREE.MathUtils.clamp(agentPosition.z, -halfDepth, halfDepth);

        // Update agent position
        agent.position.copy(agentPosition);

        // Render scene
        //renderer.clippingPlanes = clipplanes_wifi1.concat(clipplanes_wifi2, clipplanes_wifi3);
        renderer.localClippingEnabled = true;
        renderer.render(scene, camera2);

        // Request next frame
        requestAnimationFrame(render);
    }
    render();
}

main();