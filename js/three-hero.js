/* ==========================================================================
   EarthlingAidTech - Three.js Hero Scene
   Floating abstract 3D object with anti-gravity motion
   ========================================================================== */

class HeroScene {
  constructor() {
    this.canvas = document.getElementById('hero-canvas');
    if (!this.canvas) return;
    
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.nodes = [];
    this.connections = [];
    this.mouse = { x: 0, y: 0 };
    this.clock = new THREE.Clock();
    
    this.init();
    this.createNodes();
    this.createConnections();
    this.addEventListeners();
    this.animate();
  }
  
  init() {
    // Scene
    this.scene = new THREE.Scene();
    
    // Camera
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.z = 30;
    
    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);
    
    const pointLight = new THREE.PointLight(0x4A9EFF, 1, 100);
    pointLight.position.set(10, 10, 20);
    this.scene.add(pointLight);
    
    const pointLight2 = new THREE.PointLight(0x5ECFCF, 0.5, 100);
    pointLight2.position.set(-10, -10, 15);
    this.scene.add(pointLight2);
  }
  
  createNodes() {
    // Central large sphere
    const centralGeometry = new THREE.SphereGeometry(2, 32, 32);
    const centralMaterial = new THREE.MeshStandardMaterial({
      color: 0x4A9EFF,
      roughness: 0.7,
      metalness: 0.2,
      emissive: 0x4A9EFF,
      emissiveIntensity: 0.2
    });
    const centralSphere = new THREE.Mesh(centralGeometry, centralMaterial);
    this.scene.add(centralSphere);
    this.nodes.push({ mesh: centralSphere, basePos: { x: 0, y: 0, z: 0 }, speed: 0.5 });
    
    // Orbiting nodes
    const nodePositions = [
      { x: -8, y: 4, z: -2, size: 0.8 },
      { x: 7, y: -3, z: 3, size: 0.6 },
      { x: -5, y: -5, z: 1, size: 0.7 },
      { x: 6, y: 5, z: -3, size: 0.5 },
      { x: 0, y: 7, z: 2, size: 0.6 },
      { x: -3, y: 0, z: 5, size: 0.4 },
      { x: 4, y: -6, z: -2, size: 0.5 },
      { x: -7, y: 2, z: 3, size: 0.55 },
      { x: 5, y: 3, z: 4, size: 0.45 },
      { x: -2, y: -7, z: -1, size: 0.65 }
    ];
    
    nodePositions.forEach((pos, i) => {
      const geometry = new THREE.SphereGeometry(pos.size, 16, 16);
      const material = new THREE.MeshStandardMaterial({
        color: i % 2 === 0 ? 0x5ECFCF : 0x4A9EFF,
        roughness: 0.8,
        metalness: 0.1,
        transparent: true,
        opacity: 0.9
      });
      const sphere = new THREE.Mesh(geometry, material);
      sphere.position.set(pos.x, pos.y, pos.z);
      this.scene.add(sphere);
      this.nodes.push({
        mesh: sphere,
        basePos: { x: pos.x, y: pos.y, z: pos.z },
        speed: 0.3 + Math.random() * 0.4,
        phase: Math.random() * Math.PI * 2
      });
    });
  }
  
  createConnections() {
    // Create lines connecting nodes to center
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x4A9EFF,
      transparent: true,
      opacity: 0.2
    });
    
    for (let i = 1; i < this.nodes.length; i++) {
      const points = [];
      points.push(new THREE.Vector3(0, 0, 0));
      points.push(new THREE.Vector3(
        this.nodes[i].basePos.x,
        this.nodes[i].basePos.y,
        this.nodes[i].basePos.z
      ));
      
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geometry, lineMaterial);
      this.scene.add(line);
      this.connections.push({ line, nodeIndex: i });
    }
  }
  
  addEventListeners() {
    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));
    
    // Check for reduced motion preference
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.reducedMotion = true;
    }
  }
  
  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  
  onMouseMove(event) {
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  }
  
  animate() {
    requestAnimationFrame(() => this.animate());
    
    const time = this.clock.getElapsedTime();
    
    // Animate nodes with floating motion
    this.nodes.forEach((node, i) => {
      if (this.reducedMotion) return;
      
      const floatY = Math.sin(time * node.speed + (node.phase || 0)) * 0.5;
      const floatX = Math.cos(time * node.speed * 0.7 + (node.phase || 0)) * 0.3;
      
      node.mesh.position.y = node.basePos.y + floatY;
      node.mesh.position.x = node.basePos.x + floatX;
      
      // Slow rotation
      node.mesh.rotation.x += 0.002;
      node.mesh.rotation.y += 0.003;
    });
    
    // Update connection lines
    this.connections.forEach((conn) => {
      const nodePos = this.nodes[conn.nodeIndex].mesh.position;
      const positions = conn.line.geometry.attributes.position.array;
      positions[3] = nodePos.x;
      positions[4] = nodePos.y;
      positions[5] = nodePos.z;
      conn.line.geometry.attributes.position.needsUpdate = true;
    });
    
    // Parallax effect based on mouse
    this.scene.rotation.y = this.mouse.x * 0.1;
    this.scene.rotation.x = this.mouse.y * 0.05;
    
    this.renderer.render(this.scene, this.camera);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Only initialize if Three.js is loaded
  if (typeof THREE !== 'undefined') {
    new HeroScene();
  }
});
