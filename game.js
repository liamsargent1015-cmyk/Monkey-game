// Game configuration
const LEVEL_CONFIG = {
    1: { hp: 100, damage: 10, weapon: 'Fist', speed: 1, xpRequired: 100, knockback: 0, effect: 'punch', damageType: 'physical' },
    2: { hp: 120, damage: 20, weapon: 'Bat', speed: 1, xpRequired: 150, knockback: 8, effect: 'smack', damageType: 'physical' },
    3: { hp: 125, damage: 35, weapon: 'Spike', speed: 1, xpRequired: 200, knockback: 5, effect: 'stab', damageType: 'pierce' },
    4: { hp: 200, damage: 40, weapon: 'Taco', speed: 1, xpRequired: 250, knockback: 10, effect: 'sauce', damageType: 'fire' },
    5: { hp: 150, damage: 50, weapon: 'Boulder', speed: 1, xpRequired: 300, knockback: 15, effect: 'splash', damageType: 'area' },
    6: { hp: 200, damage: 80, weapon: 'Lightsaber', speed: 1, xpRequired: 350, knockback: 5, effect: 'slice', damageType: 'energy' },
    7: { hp: 700, damage: 100, weapon: 'Mech Suit', speed: 1, xpRequired: 400, knockback: 20, effect: 'stomp', damageType: 'area' },
    8: { hp: 400, damage: 10, weapon: 'Fist (8x Speed)', speed: 8, xpRequired: 450, knockback: 0, effect: 'rapid', damageType: 'physical' },
    9: { hp: 1000, damage: 150, weapon: 'Nerf Gun', speed: 1, xpRequired: 500, knockback: 10, effect: 'blast', damageType: 'projectile' },
    10: { hp: 2000, damage: 200, weapon: 'Godzilla Breath', speed: 1, xpRequired: 999999, knockback: 25, effect: 'laser', damageType: 'laser' }
};

const BLOON_CONFIG = {
    base: { speed: 0.15, spawnRate: 3, health: 20, xpReward: 10 },
    scaling: { speedIncrease: 0.02, healthIncrease: 5, spawnIncrease: 0.5 }
};

// Three.js scene setup
let scene, camera, renderer;
let monkey, monkeyHealth, monkeyMaxHealth, currentLevel = 1, currentXP = 0, kills = 0, currentRound = 1;
let bloons = [];
let keys = {};
let mouseX = 0, mouseY = 0;
let isAttacking = false;
let lastAttackTime = 0;
let attackCooldown = 200;
let mapType = 'beach';

function init(selectedMap) {
    mapType = selectedMap;
    
    // Hide menu
    document.getElementById('startMenu').classList.add('hidden');
    
    // Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(mapType === 'beach' ? 0x87CEEB : 0x7cb342);
    scene.fog = new THREE.Fog(mapType === 'beach' ? 0x87CEEB : 0x7cb342, 500, 1500);
    
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
    camera.position.set(0, 3, 10);
    camera.lookAt(0, 1, 0);
    
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowShadowMap;
    document.body.appendChild(renderer.domElement);
    
    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -200;
    directionalLight.shadow.camera.right = 200;
    directionalLight.shadow.camera.top = 200;
    directionalLight.shadow.camera.bottom = -200;
    scene.add(directionalLight);
    
    // Ground
    const groundGeometry = new THREE.PlaneGeometry(500, 500);
    const groundMaterial = new THREE.MeshStandardMaterial({
        color: mapType === 'beach' ? 0xF4A460 : 0x7cb342,
        roughness: 0.8,
        metalness: 0
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    
    // Add some environmental objects
    if (mapType === 'beach') {
        // Palm trees
        for (let i = 0; i < 5; i++) {
            addPalmTree(-150 + i * 75, 0, -150);
            addPalmTree(-150 + i * 75, 0, 150);
        }
    } else {
        // Trees
        for (let i = 0; i < 8; i++) {
            addTree(-150 + i * 50, 0, -150 + Math.random() * 50);
            addTree(-150 + i * 50, 0, 150 - Math.random() * 50);
        }
    }
    
    // Create monkey
    createMonkey();
    monkeyHealth = LEVEL_CONFIG[currentLevel].hp;
    monkeyMaxHealth = LEVEL_CONFIG[currentLevel].hp;
    
    // Input
    window.addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = true; });
    window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
    window.addEventListener('mousemove', (e) => {
        mouseX = (e.clientX / window.innerWidth) * 2 - 1;
        mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
    });
    window.addEventListener('click', () => { isAttacking = true; });
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
    
    // Start game loop
    gameLoop();
}

function createMonkey() {
    if (monkey) scene.remove(monkey);
    
    // Monkey body
    const group = new THREE.Group();
    
    // Head
    const headGeometry = new THREE.SphereGeometry(0.8, 32, 32);
    const brownMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.7 });
    const head = new THREE.Mesh(headGeometry, brownMaterial);
    head.position.y = 1.5;
    head.castShadow = true;
    group.add(head);
    
    // Eyes
    const eyeGeometry = new THREE.SphereGeometry(0.15, 16, 16);
    const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0xFFFFFF });
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.25, 1.8, 0.6);
    leftEye.castShadow = true;
    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.25, 1.8, 0.6);
    rightEye.castShadow = true;
    group.add(leftEye, rightEye);
    
    // Pupils
    const pupilGeometry = new THREE.SphereGeometry(0.08, 16, 16);
    const pupilMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
    const leftPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
    leftPupil.position.set(-0.25, 1.8, 0.75);
    leftPupil.castShadow = true;
    const rightPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
    rightPupil.position.set(0.25, 1.8, 0.75);
    rightPupil.castShadow = true;
    group.add(leftPupil, rightPupil);
    
    // Body
    const bodyGeometry = new THREE.CapsuleGeometry(0.5, 1.2, 8, 8);
    const body = new THREE.Mesh(bodyGeometry, brownMaterial);
    body.position.y = 0.8;
    body.castShadow = true;
    group.add(body);
    
    // Arms
    const armGeometry = new THREE.CapsuleGeometry(0.25, 1, 8, 8);
    const leftArm = new THREE.Mesh(armGeometry, brownMaterial);
    leftArm.position.set(-0.8, 1.2, 0);
    leftArm.rotation.z = Math.PI / 4;
    leftArm.castShadow = true;
    const rightArm = new THREE.Mesh(armGeometry, brownMaterial);
    rightArm.position.set(0.8, 1.2, 0);
    rightArm.rotation.z = -Math.PI / 4;
    rightArm.castShadow = true;
    group.add(leftArm, rightArm);
    group.rightArm = rightArm; // For attacking animation
    
    // Legs
    const legGeometry = new THREE.CapsuleGeometry(0.25, 0.8, 8, 8);
    const leftLeg = new THREE.Mesh(legGeometry, brownMaterial);
    leftLeg.position.set(-0.35, 0.2, 0);
    leftLeg.castShadow = true;
    const rightLeg = new THREE.Mesh(legGeometry, brownMaterial);
    rightLeg.position.set(0.35, 0.2, 0);
    rightLeg.castShadow = true;
    group.add(leftLeg, rightLeg);
    
    // Weapon display
    group.weaponGroup = new THREE.Group();
    group.weaponGroup.position.set(1, 1, -0.5);
    group.add(group.weaponGroup);
    
    updateMonkeyWeapon(group);
    
    group.position.set(0, 0, 0);
    scene.add(group);
    monkey = group;
}

function updateMonkeyWeapon(group) {
    // Clear old weapon
    while (group.weaponGroup.children.length > 0) {
        group.weaponGroup.remove(group.weaponGroup.children[0]);
    }
    
    const level = currentLevel;
    const config = LEVEL_CONFIG[level];
    
    if (level === 1 || level === 8) {
        // Fist - no visual weapon
        return;
    } else if (level === 2) {
        // Bat
        const batGeometry = new THREE.BoxGeometry(0.2, 0.15, 3);
        const batMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        const bat = new THREE.Mesh(batGeometry, batMaterial);
        bat.castShadow = true;
        group.weaponGroup.add(bat);
    } else if (level === 3) {
        // Spike
        const spikeGeometry = new THREE.ConeGeometry(0.3, 2, 8);
        const spikeMaterial = new THREE.MeshStandardMaterial({ color: 0xA0A0A0, metalness: 0.8 });
        const spike = new THREE.Mesh(spikeGeometry, spikeMaterial);
        spike.castShadow = true;
        group.weaponGroup.add(spike);
    } else if (level === 4) {
        // Taco
        const tacoGeometry = new THREE.ConeGeometry(0.8, 1.5, 16);
        const tacoMaterial = new THREE.MeshStandardMaterial({ color: 0xFF8C00 });
        const taco = new THREE.Mesh(tacoGeometry, tacoMaterial);
        taco.castShadow = true;
        group.weaponGroup.add(taco);
    } else if (level === 5) {
        // Boulder
        const boulderGeometry = new THREE.SphereGeometry(0.7, 16, 16);
        const boulderMaterial = new THREE.MeshStandardMaterial({ color: 0x808080, roughness: 0.9 });
        const boulder = new THREE.Mesh(boulderGeometry, boulderMaterial);
        boulder.castShadow = true;
        group.weaponGroup.add(boulder);
    } else if (level === 6) {
        // Lightsaber
        const saber = new THREE.Group();
        const handleGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.8, 8);
        const handleMaterial = new THREE.MeshStandardMaterial({ color: 0x000000, metalness: 1 });
        const handle = new THREE.Mesh(handleGeometry, handleMaterial);
        saber.add(handle);
        
        const bladeGeometry = new THREE.CylinderGeometry(0.1, 0.1, 2, 8);
        const bladeMaterial = new THREE.MeshStandardMaterial({ color: 0x00FF00, emissive: 0x00FF00 });
        const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
        blade.position.y = 1.4;
        blade.castShadow = true;
        saber.add(blade);
        group.weaponGroup.add(saber);
    } else if (level === 7) {
        // Mech suit - just a visual upgrade on the monkey
        return;
    } else if (level === 9) {
        // Nerf gun
        const gunGeometry = new THREE.BoxGeometry(0.3, 0.2, 1.5);
        const gunMaterial = new THREE.MeshStandardMaterial({ color: 0xFFFF00 });
        const gun = new THREE.Mesh(gunGeometry, gunMaterial);
        gun.castShadow = true;
        group.weaponGroup.add(gun);
    } else if (level === 10) {
        // Godzilla - no weapon needed
        return;
    }
}

function addPalmTree(x, y, z) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 4), new THREE.MeshStandardMaterial({ color: 0x8B4513 }));
    trunk.position.set(x, 2, z);
    trunk.castShadow = true;
    scene.add(trunk);
    
    const leaves = new THREE.Mesh(new THREE.SphereGeometry(2, 16, 16), new THREE.MeshStandardMaterial({ color: 0x228B22 }));
    leaves.position.set(x, 5, z);
    leaves.castShadow = true;
    scene.add(leaves);
}

function addTree(x, y, z) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 5), new THREE.MeshStandardMaterial({ color: 0x654321 }));
    trunk.position.set(x, 2.5, z);
    trunk.castShadow = true;
    scene.add(trunk);
    
    const leaves = new THREE.Mesh(new THREE.SphereGeometry(2.5, 16, 16), new THREE.MeshStandardMaterial({ color: 0x228B22 }));
    leaves.position.set(x, 6, z);
    leaves.castShadow = true;
    scene.add(leaves);
}

function spawnBloon() {
    const angle = Math.random() * Math.PI * 2;
    const distance = 80;
    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;
    
    const scaleFactor = 1 + (currentRound - 1) * 0.05;
    const isSpecial = currentRound === 40 || currentRound === 80;
    
    let bloon = {
        mesh: null,
        position: new THREE.Vector3(x, 1, z),
        health: isSpecial ? (currentRound === 40 ? 100 : 200) : Math.max(20 + (currentRound - 1) * BLOON_CONFIG.scaling.healthIncrease, 20),
        maxHealth: isSpecial ? (currentRound === 40 ? 100 : 200) : Math.max(20 + (currentRound - 1) * BLOON_CONFIG.scaling.healthIncrease, 20),
        speed: BLOON_CONFIG.base.speed + (currentRound - 1) * BLOON_CONFIG.scaling.speedIncrease,
        xpReward: 10 + (currentRound - 1) * 2,
        isSpecial: isSpecial,
        specialType: currentRound === 40 ? 'arms' : currentRound === 80 ? 'rainbow' : 'normal',
        damageToMonkey: isSpecial ? (currentRound === 40 ? 40 : 80) : 5,
        attackCooldown: 0
    };
    
    // Create visual
    if (bloon.specialType === 'arms') {
        // Big bloon with arms
        const bodyGeom = new THREE.SphereGeometry(1.5, 32, 32);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xFF69B4 });
        bloon.mesh = new THREE.Mesh(bodyGeom, bodyMat);
        
        const armGeom = new THREE.SphereGeometry(0.4, 16, 16);
        const arm1 = new THREE.Mesh(armGeom, bodyMat);
        arm1.position.set(-1.8, 0.5, 0);
        const arm2 = new THREE.Mesh(armGeom, bodyMat);
        arm2.position.set(1.8, 0.5, 0);
        bloon.mesh.add(arm1, arm2);
    } else if (bloon.specialType === 'rainbow') {
        // Rainbow bloon
        const rainbowGeom = new THREE.SphereGeometry(2, 32, 32);
        const rainbowMat = new THREE.MeshStandardMaterial({
            color: 0xFF00FF,
            emissive: 0xFF00FF,
            metalness: 0.5,
            roughness: 0.3
        });
        bloon.mesh = new THREE.Mesh(rainbowGeom, rainbowMat);
    } else {
        // Normal bloon
        const geometry = new THREE.SphereGeometry(0.5 * scaleFactor, 32, 32);
        const colors = [0xFF0000, 0x0000FF, 0xFFFF00, 0x00FF00, 0xFF00FF];
        const color = colors[Math.floor(Math.random() * colors.length)];
        const material = new THREE.MeshStandardMaterial({ color: color });
        bloon.mesh = new THREE.Mesh(geometry, material);
    }
    
    bloon.mesh.position.copy(bloon.position);
    bloon.mesh.castShadow = true;
    scene.add(bloon.mesh);
    
    bloons.push(bloon);
}

function updateMonkey() {
    const speed = 0.5;
    let moved = false;
    
    if (keys['w']) {
        monkey.position.z -= speed;
        moved = true;
    }
    if (keys['a']) {
        monkey.position.x -= speed;
        moved = true;
    }
    if (keys['s']) {
        monkey.position.z += speed;
        moved = true;
    }
    if (keys['d']) {
        monkey.position.x += speed;
        moved = true;
    }
    
    // Clamp position
    monkey.position.x = Math.max(-200, Math.min(200, monkey.position.x));
    monkey.position.z = Math.max(-200, Math.min(200, monkey.position.z));
    
    // Update camera to follow monkey with third-person view
    const cameraDistance = 15;
    const cameraHeight = 5;
    camera.position.x = monkey.position.x;
    camera.position.y = monkey.position.y + cameraHeight;
    camera.position.z = monkey.position.z + cameraDistance;
    camera.lookAt(monkey.position.x, monkey.position.y + 1, monkey.position.z);
    
    // Attack
    if (isAttacking && Date.now() - lastAttackTime > attackCooldown / LEVEL_CONFIG[currentLevel].speed) {
        lastAttackTime = Date.now();
        performAttack();
        isAttacking = false;
    }
}

function performAttack() {
    const attackRange = 10;
    const config = LEVEL_CONFIG[currentLevel];
    
    for (let bloon of bloons) {
        const dist = monkey.position.distanceTo(bloon.position);
        
        if (dist < attackRange) {
            bloon.health -= config.damage;
            
            // Knockback
            if (config.knockback > 0) {
                const direction = new THREE.Vector3().subVectors(bloon.position, monkey.position).normalize();
                bloon.position.add(direction.multiplyScalar(config.knockback * 0.1));
            }
            
            // Visual feedback
            bloon.mesh.scale.set(1.2, 1.2, 1.2);
            setTimeout(() => { bloon.mesh.scale.set(1, 1, 1); }, 50);
            
            if (bloon.health <= 0) {
                removeBloon(bloon);
                currentXP += bloon.xpReward;
                kills++;
                document.getElementById('killsDisplay').textContent = kills;
                checkLevelUp();
            }
        }
    }
}

function updateBloons() {
    for (let i = bloons.length - 1; i >= 0; i--) {
        const bloon = bloons[i];
        const direction = new THREE.Vector3().subVectors(monkey.position, bloon.position).normalize();
        bloon.position.add(direction.multiplyScalar(bloon.speed));
        bloon.mesh.position.copy(bloon.position);
        
        // Check collision with monkey
        const dist = monkey.position.distanceTo(bloon.position);
        if (dist < 2) {
            bloon.attackCooldown++;
            if (bloon.attackCooldown > 30) {
                monkeyHealth -= bloon.damageToMonkey;
                bloon.attackCooldown = 0;
                document.getElementById('hpDisplay').textContent = Math.max(0, monkeyHealth);
                
                if (monkeyHealth <= 0) {
                    endGame();
                }
            }
        }
        
        // Remove if too far
        if (bloon.position.length() > 300) {
            removeBloon(bloon);
        }
    }
}

function removeBloon(bloon) {
    scene.remove(bloon.mesh);
    const index = bloons.indexOf(bloon);
    if (index > -1) bloons.splice(index, 1);
}

function checkLevelUp() {
    const config = LEVEL_CONFIG[currentLevel];
    if (currentXP >= config.xpRequired && currentLevel < 10) {
        currentLevel++;
        currentXP = 0;
        const newConfig = LEVEL_CONFIG[currentLevel];
        monkeyMaxHealth = newConfig.hp;
        monkeyHealth = newConfig.hp;
        updateMonkeyWeapon(monkey);
        createMonkey();
        document.getElementById('levelDisplay').textContent = currentLevel;
        document.getElementById('weaponName').textContent = newConfig.weapon;
        document.getElementById('damageDisplay').textContent = newConfig.damage;
        document.getElementById('speedDisplay').textContent = newConfig.speed + 'x';
        document.getElementById('hpDisplay').textContent = monkeyHealth;
    }
    
    // Update XP bar
    const xpPercent = (currentXP / LEVEL_CONFIG[currentLevel].xpRequired) * 100;
    document.getElementById('xpFill').style.width = xpPercent + '%';
    document.getElementById('xpText').textContent = currentXP + '/' + LEVEL_CONFIG[currentLevel].xpRequired + ' XP';
}

function updateRound() {
    const spawnRate = BLOON_CONFIG.base.spawnRate + (currentRound - 1) * BLOON_CONFIG.scaling.spawnIncrease;
    
    if (Math.random() < spawnRate * 0.01) {
        spawnBloon();
    }
    
    document.getElementById('roundDisplay').textContent = currentRound;
}

function endGame() {
    document.getElementById('gameOver').style.display = 'block';
    document.getElementById('finalRound').textContent = currentRound;
    document.getElementById('finalLevel').textContent = currentLevel;
    document.getElementById('finalKills').textContent = kills;
    cancelAnimationFrame(animationId);
}

let spawnCounter = 0;
let animationId;

function gameLoop() {
    animationId = requestAnimationFrame(gameLoop);
    
    updateMonkey();
    updateBloons();
    updateRound();
    
    // Spawn bloons
    spawnCounter++;
    const spawnRate = 60 / (BLOON_CONFIG.base.spawnRate + (currentRound - 1) * BLOON_CONFIG.scaling.spawnIncrease);
    if (spawnCounter > spawnRate) {
        spawnBloon();
        spawnCounter = 0;
        
        // Advance round
        if (bloons.length === 0 && Math.random() > 0.9) {
            if (currentRound < 80) {
                currentRound++;
            } else {
                endGame();
            }
        }
    }
    
    renderer.render(scene, camera);
}

function startGame(mapType) {
    init(mapType);
}
