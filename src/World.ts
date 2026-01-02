import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';
import { worldDB } from './DB';

// Block IDs
export const BLOCK = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  BEDROCK: 4,
  WOOD: 5,
  LEAVES: 6
};

type Chunk = {
  mesh: THREE.Mesh;
  // Visual mesh only, data is stored in chunksData
};

export class World {
  private scene: THREE.Scene;
  private chunkSize: number = 16;
  
  // Visuals
  private chunks: Map<string, Chunk> = new Map();
  
  // Data Store
  private chunksData: Map<string, Uint8Array> = new Map();
  private dirtyChunks: Set<string> = new Set();
  private knownChunkKeys: Set<string> = new Set(); // Keys that exist in DB
  private loadingChunks: Set<string> = new Set(); // Keys currently being fetched from DB

  private seed: number;
  private noise2D: (x: number, y: number) => number;
  public noiseTexture: THREE.DataTexture;

  // Terrain Settings
  private TERRAIN_SCALE = 50;
  private TERRAIN_HEIGHT = 8;
  private OFFSET = 4;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.seed = Math.floor(Math.random() * 2147483647);
    this.noise2D = this.createNoiseGenerator();
    this.noiseTexture = this.createNoiseTexture();
  }

  private createNoiseGenerator() {
      // Mulberry32 PRNG
      let a = this.seed;
      const random = () => {
          let t = a += 0x6D2B79F5;
          t = Math.imul(t ^ t >>> 15, t | 1);
          t ^= t + Math.imul(t ^ t >>> 7, t | 61);
          return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
      return createNoise2D(random);
  }

  // --- Persistence Methods ---

  public async loadWorld(): Promise<{ playerPosition?: THREE.Vector3, inventory?: any }> {
    await worldDB.init();
    
    // Load meta
    const meta = await worldDB.get('player', 'meta');
    
    // Load all chunk keys so we know what to fetch vs generate
    const keys = await worldDB.keys('chunks');
    keys.forEach(k => this.knownChunkKeys.add(k as string));

    if (meta && meta.seed !== undefined) {
        this.seed = meta.seed;
        console.log(`Loaded seed: ${this.seed}`);
        this.noise2D = this.createNoiseGenerator();
    } else {
        console.log(`No seed found, using current: ${this.seed}`);
    }

    console.log(`Loaded world index. ${this.knownChunkKeys.size} chunks in DB.`);

    return meta ? { 
        playerPosition: new THREE.Vector3(meta.position.x, meta.position.y, meta.position.z),
        inventory: meta.inventory 
    } : {};
  }

  public async saveWorld(playerData: { position: THREE.Vector3, inventory: any }) {
    console.log('Saving world...');
    
    // Save Meta
    await worldDB.set('player', {
        position: { x: playerData.position.x, y: playerData.position.y, z: playerData.position.z },
        inventory: playerData.inventory,
        seed: this.seed
    }, 'meta');

    // Save Dirty Chunks
    const promises: Promise<void>[] = [];
    for (const key of this.dirtyChunks) {
        const data = this.chunksData.get(key);
        if (data) {
            promises.push(worldDB.set(key, data, 'chunks'));
            this.knownChunkKeys.add(key);
        }
    }
    
    await Promise.all(promises);
    this.dirtyChunks.clear();
    console.log('World saved.');
  }

  public async deleteWorld() {
    console.log('Deleting world...');
    await worldDB.init();
    await worldDB.clear();
    
    this.chunksData.clear();
    this.dirtyChunks.clear();
    this.knownChunkKeys.clear();
    this.loadingChunks.clear();
    
    // Remove all meshes
    for (const [key, chunk] of this.chunks) {
        this.scene.remove(chunk.mesh);
        chunk.mesh.geometry.dispose();
        (chunk.mesh.material as THREE.Material).dispose();
    }
    this.chunks.clear();
    
    // Reset seed
    this.seed = Math.floor(Math.random() * 2147483647);
    this.noise2D = this.createNoiseGenerator();

    console.log('World deleted.');
  }

  private checkMemory(playerPos: THREE.Vector3) {
      if (this.chunksData.size <= 500) return;

      const cx = Math.floor(playerPos.x / this.chunkSize);
      const cz = Math.floor(playerPos.z / this.chunkSize);

      // Find furthest chunks
      const entries = Array.from(this.chunksData.entries());
      entries.sort((a, b) => {
          const [ak, ] = a;
          const [bk, ] = b;
          const [ax, az] = ak.split(',').map(Number);
          const [bx, bz] = bk.split(',').map(Number);
          
          const distA = (ax - cx) ** 2 + (az - cz) ** 2;
          const distB = (bx - cx) ** 2 + (bz - cz) ** 2;
          
          return distB - distA; // Descending distance
      });

      // Remove 50 furthest chunks
      for (let i = 0; i < 50; i++) {
          if (i >= entries.length) break;
          const [key, data] = entries[i];
          
          // Ensure saved if dirty
          if (this.dirtyChunks.has(key)) {
              worldDB.set(key, data, 'chunks').then(() => {
                  this.knownChunkKeys.add(key);
              });
              this.dirtyChunks.delete(key);
          }
          
          this.chunksData.delete(key);
          
          // Also remove mesh if exists
          const chunk = this.chunks.get(key);
          if (chunk) {
              this.scene.remove(chunk.mesh);
              chunk.mesh.geometry.dispose();
              (chunk.mesh.material as THREE.Material).dispose();
              this.chunks.delete(key);
          }
      }
      console.log('Memory cleanup performed.');
  }

  // --- Core Logic ---

  private createNoiseTexture(): THREE.DataTexture {
    const width = 32;
    const height = 16;
    const data = new Uint8Array(width * height * 4); // RGBA

    for (let i = 0; i < width * height; i++) {
      const stride = i * 4;
      const x = i % width;
      
      const v = Math.floor(Math.random() * (255 - 150) + 150); // 150-255
      data[stride] = v;     // R
      data[stride + 1] = v; // G
      data[stride + 2] = v; // B

      // Alpha logic
      if (x >= 16) {
          // Right half: Leaves with transparency
          // Simple noise for transparency: random dots
          if (Math.random() < 0.4) {
             data[stride + 3] = 0;
          } else {
             data[stride + 3] = 255;
          }
      } else {
          // Left half: Solid
          data[stride + 3] = 255;
      }
    }

    const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.needsUpdate = true;
    return texture;
  }

  public update(playerPos: THREE.Vector3) {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 0 && window.innerWidth < 1024);
    const radius = isMobile ? 2 : 3; // 5x5 vs 7x7

    const cx = Math.floor(playerPos.x / this.chunkSize);
    const cz = Math.floor(playerPos.z / this.chunkSize);

    const activeChunks = new Set<string>();

    // Generate grid
    for (let x = cx - radius; x <= cx + radius; x++) {
      for (let z = cz - radius; z <= cz + radius; z++) {
        const key = `${x},${z}`;
        activeChunks.add(key);

        if (!this.chunks.has(key)) {
             this.ensureChunk(x, z, key);
        }
      }
    }

    // Unload far visuals
    for (const [key, chunk] of this.chunks) {
      if (!activeChunks.has(key)) {
        this.scene.remove(chunk.mesh);
        chunk.mesh.geometry.dispose();
        (chunk.mesh.material as THREE.Material).dispose();
        this.chunks.delete(key);
      }
    }

    // Memory cleanup occasionally (more aggressive on mobile)
    if (Math.random() < (isMobile ? 0.05 : 0.01)) {
        this.checkMemory(playerPos);
    }
  }

  private async ensureChunk(cx: number, cz: number, key: string) {
      // 1. Check RAM
      if (this.chunksData.has(key)) {
          this.buildChunkMesh(cx, cz, this.chunksData.get(key)!);
          return;
      }

      // 2. Check DB
      if (this.knownChunkKeys.has(key)) {
          if (this.loadingChunks.has(key)) return; // Already loading
          this.loadingChunks.add(key);
          
          worldDB.get(key, 'chunks').then((data: Uint8Array) => {
              if (data) {
                  this.chunksData.set(key, data);
                  this.buildChunkMesh(cx, cz, data);
              } else {
                  // Fallback if key existed but data missing?
                  this.generateChunk(cx, cz);
              }
          }).finally(() => {
              this.loadingChunks.delete(key);
          });
          return;
      }

      // 3. Generate New
      this.generateChunk(cx, cz);
  }

  public isChunkLoaded(x: number, z: number): boolean {
    const cx = Math.floor(x / this.chunkSize);
    const cz = Math.floor(z / this.chunkSize);
    const key = `${cx},${cz}`;
    return this.chunksData.has(key);
  }

  public hasBlock(x: number, y: number, z: number): boolean {
    const cx = Math.floor(x / this.chunkSize);
    const cz = Math.floor(z / this.chunkSize);
    const key = `${cx},${cz}`;

    const data = this.chunksData.get(key);
    if (!data) return false;

    // Convert to local chunk coordinates
    const localX = x - cx * this.chunkSize;
    const localZ = z - cz * this.chunkSize;
    const localY = y; 

    if (localY < 0 || localY >= this.chunkSize) return false;

    const index = this.getBlockIndex(localX, localY, localZ);
    return data[index] !== BLOCK.AIR;
  }

  public getBreakTime(type: number): number {
    switch (type) {
        case BLOCK.LEAVES: return 1000;
        case BLOCK.DIRT:
        case BLOCK.GRASS: return 3000;
        case BLOCK.WOOD: return 5000;
        case BLOCK.STONE: return 20000;
        case BLOCK.BEDROCK: return Infinity;
        default: return 1000;
    }
  }

  public getBlock(x: number, y: number, z: number): number {
    const cx = Math.floor(x / this.chunkSize);
    const cz = Math.floor(z / this.chunkSize);
    const key = `${cx},${cz}`;

    const data = this.chunksData.get(key);
    if (!data) return 0; // AIR

    const localX = x - cx * this.chunkSize;
    const localZ = z - cz * this.chunkSize;
    const localY = y;

    if (localY < 0 || localY >= this.chunkSize) return 0;

    const index = this.getBlockIndex(localX, localY, localZ);
    return data[index];
  }

  public setBlock(x: number, y: number, z: number, type: number) {
    const cx = Math.floor(x / this.chunkSize);
    const cz = Math.floor(z / this.chunkSize);
    const key = `${cx},${cz}`;

    const data = this.chunksData.get(key);
    if (!data) return;

    const localX = x - cx * this.chunkSize;
    const localZ = z - cz * this.chunkSize;
    const localY = y;

    if (localY < 0 || localY >= this.chunkSize) return;

    const index = this.getBlockIndex(localX, localY, localZ);
    data[index] = type;
    this.dirtyChunks.add(key); // Mark for save

    // Regenerate mesh
    const chunk = this.chunks.get(key);
    if (chunk) {
        this.scene.remove(chunk.mesh);
        chunk.mesh.geometry.dispose();
        (chunk.mesh.material as THREE.Material).dispose();
    }

    const newMesh = this.generateChunkMesh(data, cx, cz);
    this.scene.add(newMesh);
    this.chunks.set(key, { mesh: newMesh });
  }

  private getBlockIndex(x: number, y: number, z: number): number {
    return x + y * this.chunkSize + z * this.chunkSize * this.chunkSize;
  }

  private placeTree(data: Uint8Array, startX: number, startY: number, startZ: number) {
    const trunkHeight = Math.floor(Math.random() * 2) + 4; // 4-5 blocks

    // Trunk
    for (let y = 0; y < trunkHeight; y++) {
      const currentY = startY + y;
      if (currentY < this.chunkSize) {
        const index = this.getBlockIndex(startX, currentY, startZ);
        data[index] = BLOCK.WOOD;
      }
    }

    // Leaves (Volumetric)
    const leavesStart = startY + trunkHeight - 2;
    const leavesEnd = startY + trunkHeight + 1; // 1 block above trunk top
    
    for (let y = leavesStart; y <= leavesEnd; y++) {
      const dy = y - (startY + trunkHeight - 1); // Distance from top of trunk
      let radius = 2;
      if (dy === 2) radius = 1; // Top tip
      else if (dy === -1) radius = 2; // Bottomest layer

      for (let x = startX - radius; x <= startX + radius; x++) {
        for (let z = startZ - radius; z <= startZ + radius; z++) {
          // Corner rounding
          const dx = x - startX;
          const dz = z - startZ;
          if (Math.abs(dx) === radius && Math.abs(dz) === radius) {
             // Skip corners randomly to make it less square
             if (Math.random() < 0.4) continue;
          }

          if (
            x >= 0 && x < this.chunkSize &&
            y >= 0 && y < this.chunkSize &&
            z >= 0 && z < this.chunkSize
          ) {
             const index = this.getBlockIndex(x, y, z);
             // Don't overwrite trunk
             if (data[index] !== BLOCK.WOOD) {
               data[index] = BLOCK.LEAVES;
             }
          }
        }
      }
    }
  }

  private generateChunk(cx: number, cz: number) {
    const key = `${cx},${cz}`;
    const data = new Uint8Array(this.chunkSize * this.chunkSize * this.chunkSize);
    const startX = cx * this.chunkSize;
    const startZ = cz * this.chunkSize;

    // 1. Generate Terrain
    for (let x = 0; x < this.chunkSize; x++) {
      for (let z = 0; z < this.chunkSize; z++) {
        const worldX = startX + x;
        const worldZ = startZ + z;

        const noiseValue = this.noise2D(worldX / this.TERRAIN_SCALE, worldZ / this.TERRAIN_SCALE);
        let height = Math.floor(noiseValue * this.TERRAIN_HEIGHT) + this.OFFSET;
        
        if (height < 1) height = 1;
        if (height >= this.chunkSize) height = this.chunkSize - 1;

        for (let y = 0; y <= height; y++) {
          let type = BLOCK.STONE;
          if (y === 0) type = BLOCK.BEDROCK;
          else if (y === height) type = BLOCK.GRASS;
          else if (y >= height - 3) type = BLOCK.DIRT;
          
          const index = this.getBlockIndex(x, y, z);
          data[index] = type;
        }
      }
    }

    // 2. Generate Trees (Second Pass)
    for (let x = 0; x < this.chunkSize; x++) {
      for (let z = 0; z < this.chunkSize; z++) {
         // Boundary check to prevent cut trees
         if (x < 2 || x >= this.chunkSize - 2 || z < 2 || z >= this.chunkSize - 2) continue;

         // Find surface height
         let height = -1;
         for (let y = this.chunkSize - 1; y >= 0; y--) {
            if (data[this.getBlockIndex(x, y, z)] !== BLOCK.AIR) {
               height = y;
               break;
            }
         }

         if (height > 0) {
            const index = this.getBlockIndex(x, height, z);
            if (data[index] === BLOCK.GRASS) {
               if (Math.random() < 0.01) {
                  this.placeTree(data, x, height + 1, z);
               }
            }
         }
      }
    }

    // Save to Global Store
    this.chunksData.set(key, data);
    this.dirtyChunks.add(key); // New chunk = needs save

    // 3. Generate Mesh
    this.buildChunkMesh(cx, cz, data);
  }

  private buildChunkMesh(cx: number, cz: number, data: Uint8Array) {
      const key = `${cx},${cz}`;
      if (this.chunks.has(key)) return; // Already has mesh

      const mesh = this.generateChunkMesh(data, cx, cz);
      this.scene.add(mesh);
      this.chunks.set(key, { mesh });
  }

  private generateChunkMesh(data: Uint8Array, cx: number, cz: number): THREE.Mesh {
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const colors: number[] = [];

    const startX = cx * this.chunkSize;
    const startZ = cz * this.chunkSize;

    // Helper to add face
    const addFace = (x: number, y: number, z: number, type: number, side: string) => {
      // Local block coords
      const localX = x;
      const localY = y;
      const localZ = z;
      
      const x0 = localX;
      const x1 = localX + 1;
      const y0 = localY;
      const y1 = localY + 1;
      const z0 = localZ;
      const z1 = localZ + 1;

      // Color Logic
      let r = 0.5, g = 0.5, b = 0.5;
      if (type === BLOCK.STONE) { r=0.5; g=0.5; b=0.5; }
      else if (type === BLOCK.BEDROCK) { r=0.13; g=0.13; b=0.13; }
      else if (type === BLOCK.DIRT) { r=0.54; g=0.27; b=0.07; } // Brown
      else if (type === BLOCK.GRASS) {
        if (side === 'top') { r=0.33; g=0.6; b=0.33; } // Green
        else { r=0.54; g=0.27; b=0.07; } // Dirt side
      }
      else if (type === BLOCK.WOOD) { r=0.4; g=0.2; b=0.0; } // Dark Brown
      else if (type === BLOCK.LEAVES) { r=0.13; g=0.55; b=0.13; } // Forest Green

      // Append data based on side
      if (side === 'top') {
        // y+
        positions.push(x0, y1, z1,  x1, y1, z1,  x0, y1, z0,  x1, y1, z0);
        normals.push(0,1,0, 0,1,0, 0,1,0, 0,1,0);
      } else if (side === 'bottom') {
        // y-
        positions.push(x0, y0, z0,  x1, y0, z0,  x0, y0, z1,  x1, y0, z1);
        normals.push(0,-1,0, 0,-1,0, 0,-1,0, 0,-1,0);
      } else if (side === 'front') {
        // z+
        positions.push(x0, y0, z1,  x1, y0, z1,  x0, y1, z1,  x1, y1, z1);
        normals.push(0,0,1, 0,0,1, 0,0,1, 0,0,1);
      } else if (side === 'back') {
        // z-
        positions.push(x1, y0, z0,  x0, y0, z0,  x1, y1, z0,  x0, y1, z0);
        normals.push(0,0,-1, 0,0,-1, 0,0,-1, 0,0,-1);
      } else if (side === 'right') {
        // x+
        positions.push(x1, y0, z1,  x1, y0, z0,  x1, y1, z1,  x1, y1, z0);
        normals.push(1,0,0, 1,0,0, 1,0,0, 1,0,0);
      } else if (side === 'left') {
        // x-
        positions.push(x0, y0, z0,  x0, y0, z1,  x0, y1, z0,  x0, y1, z1);
        normals.push(-1,0,0, -1,0,0, -1,0,0, -1,0,0);
      }

      // UVs 
      // Atlas: Left half (0-0.5) is Solid, Right half (0.5-1.0) is Transparent/Leaves
      // Inset to prevent bleeding
      const uvInset = 0.001;
      let u0 = 0 + uvInset;
      let u1 = 0.5 - uvInset;
      
      if (type === BLOCK.LEAVES) {
          u0 = 0.5 + uvInset;
          u1 = 1.0 - uvInset;
      }

      uvs.push(u0,0, u1,0, u0,1, u1,1);

      // Colors (4 vertices per face)
      for(let i=0; i<4; i++) colors.push(r,g,b);
    };

    // Helper to check transparency
    const isTransparent = (t: number) => {
        return t === BLOCK.AIR || t === BLOCK.LEAVES;
    };

    // Iterate
    for (let x = 0; x < this.chunkSize; x++) {
      for (let y = 0; y < this.chunkSize; y++) {
        for (let z = 0; z < this.chunkSize; z++) {
          const index = this.getBlockIndex(x, y, z);
          const type = data[index];
          
          if (type === BLOCK.AIR) continue;

          // Check neighbors
          // We draw a face if the neighbor is transparent (Air or Leaves)
          // Exception: If both are leaves, do we draw? 
          // Yes, for high quality foliage we usually do.
          // Or if neighbor is AIR.
          
          const checkNeighbor = (nx: number, ny: number, nz: number) => {
             if (nx < 0 || nx >= this.chunkSize || 
                 ny < 0 || ny >= this.chunkSize || 
                 nz < 0 || nz >= this.chunkSize) {
                 // Boundary of chunk.
                 // Ideally we check global world block, but for now we assume boundary is transparent (or culled?)
                 // If we assume transparent, we draw faces at chunk edges.
                 // This is safer to avoid gaps.
                 return true; 
             }
             const nType = data[this.getBlockIndex(nx, ny, nz)];
             return isTransparent(nType);
          };

          // Top
          if (checkNeighbor(x, y+1, z)) addFace(x, y, z, type, 'top');
          // Bottom
          if (checkNeighbor(x, y-1, z)) addFace(x, y, z, type, 'bottom');
          // Front (z+)
          if (checkNeighbor(x, y, z+1)) addFace(x, y, z, type, 'front');
          // Back (z-)
          if (checkNeighbor(x, y, z-1)) addFace(x, y, z, type, 'back');
          // Right (x+)
          if (checkNeighbor(x+1, y, z)) addFace(x, y, z, type, 'right');
          // Left (x-)
          if (checkNeighbor(x-1, y, z)) addFace(x, y, z, type, 'left');
        }
      }
    }

    const geometry = new THREE.BufferGeometry();
    const indices: number[] = [];
    
    // Convert quads (4 verts) to triangles (6 indices)
    const vertCount = positions.length / 3;
    for (let i = 0; i < vertCount; i += 4) {
      indices.push(i, i+1, i+2);
      indices.push(i+2, i+1, i+3);
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere(); // Important for culling

    const material = new THREE.MeshStandardMaterial({ 
      map: this.noiseTexture,
      vertexColors: true,
      roughness: 0.8,
      alphaTest: 0.5,
      transparent: true // Allows partial transparency if we wanted, but alphaTest handles cutout
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(startX, 0, startZ);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    return mesh;
  }
}
