import * as THREE from 'three';
import { World } from './World';

export class ItemEntity {
  public mesh: THREE.Mesh;
  public type: number;
  public isDead = false;
  
  private scene: THREE.Scene;
  private world: World;
  private timeOffset: number;
  private creationTime: number;
  private readonly maxAge = 180000; // 3 minutes
  
  private velocityY: number = 0;
  private isOnGround: boolean = false;
  private groundY: number = 0; // To store the base Y for floating

  constructor(world: World, scene: THREE.Scene, x: number, y: number, z: number, type: number, texture: THREE.DataTexture) {
    this.type = type;
    this.scene = scene;
    this.world = world;
    this.timeOffset = Math.random() * 100;
    this.creationTime = performance.now();

    const geometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    
    // Generate colors
    const colors: number[] = [];
    const count = geometry.attributes.position.count;
    
    // Color Logic
    let r = 1, g = 1, b = 1;
    if (type === 1) { r=0.33; g=0.6; b=0.33; } // Grass (Green)
    else if (type === 2) { r=0.54; g=0.27; b=0.07; } // Dirt
    else if (type === 3) { r=0.5; g=0.5; b=0.5; } // Stone
    else if (type === 4) { r=0.13; g=0.13; b=0.13; } // Bedrock
    else if (type === 5) { r=0.4; g=0.2; b=0.0; } // Wood
    else if (type === 6) { r=0.13; g=0.55; b=0.13; } // Leaves

    for (let i = 0; i < count; i++) {
      colors.push(r, g, b);
    }
    
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const material = new THREE.MeshStandardMaterial({ 
      map: texture,
      vertexColors: true,
      roughness: 0.8
    });
    
    this.mesh = new THREE.Mesh(geometry, material);
    (this.mesh as any).isItem = true;
    this.mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    
    this.scene.add(this.mesh);
  }

  update(time: number, delta: number) {
    const age = performance.now() - this.creationTime;
    
    if (age > this.maxAge) {
      this.isDead = true;
      this.dispose();
      return;
    }

    if (age > this.maxAge - 10000) {
      // Blink every 0.25 seconds
      this.mesh.visible = Math.floor(age / 250) % 2 === 0;
    } else {
      this.mesh.visible = true;
    }

    this.mesh.rotation.y = time * 2 + this.timeOffset;

    if (!this.isOnGround) {
      this.velocityY -= 20.0 * delta;
      this.mesh.position.y += this.velocityY * delta;

      // Collision Check
      const x = Math.floor(this.mesh.position.x);
      const z = Math.floor(this.mesh.position.z);

      // Check block directly underneath center?
      // Mesh is 0.3 high. Center is at y. Bottom is y - 0.15.
      const feetY = this.mesh.position.y - 0.15;
      const blockY = Math.floor(feetY);

      if (this.world.getBlock(x, blockY, z) !== 0) {
        // Landed
        this.isOnGround = true;
        this.velocityY = 0;
        this.groundY = blockY + 1 + 0.15;
        this.mesh.position.y = this.groundY;
      }
    } else {
      // Floating animation
      this.mesh.position.y = this.groundY + Math.sin(time * 3 + this.timeOffset) * 0.05;

      // Check if ground removed
      const x = Math.floor(this.mesh.position.x);
      const blockY = Math.floor(this.groundY - 1 - 0.15); // Block below groundY
      const z = Math.floor(this.mesh.position.z);
      
      if (this.world.getBlock(x, blockY, z) === 0) {
        this.isOnGround = false;
        this.velocityY = 0;
      }
    }
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
