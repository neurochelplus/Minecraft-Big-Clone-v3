import * as THREE from 'three';
import { World } from './World';
import { Zombie } from './Zombie';
import { Mob } from './Mob';

import { ItemEntity } from './ItemEntity';

import { Environment } from './Environment';

export class MobManager {
  public mobs: Mob[] = [];
  private world: World;
  private scene: THREE.Scene;
  private entities: ItemEntity[];
  
  private lastSpawnTime = 0;
  private spawnInterval = 10000; // 10 seconds
  private readonly MAX_MOBS = 10;

  constructor(world: World, scene: THREE.Scene, entities: ItemEntity[]) {
    this.world = world;
    this.scene = scene;
    this.entities = entities;
  }

  public update(delta: number, playerPos: THREE.Vector3, environment: Environment, onPlayerHit?: (damage: number) => void) {
    const now = performance.now();
    const isDay = environment.isDay;

    // 1. Update existing mobs & check despawn
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const mob = this.mobs[i];
      
      if (mob.isDead) {
         // Drop Item
         this.entities.push(new ItemEntity(
             this.world, 
             this.scene, 
             mob.mesh.position.x, 
             mob.mesh.position.y, 
             mob.mesh.position.z, 
             6, // Loot ID
             this.world.noiseTexture
         ));
         
         this.despawnMob(i);
         continue;
      }

      mob.update(delta, playerPos, onPlayerHit, isDay);

      // Despawn if too far (> 80 blocks)
      const dist = mob.mesh.position.distanceTo(playerPos);
      if (dist > 80) {
        this.despawnMob(i);
      }
    }

    // 2. Spawn logic (Only at Night)
    if (!isDay && this.mobs.length < this.MAX_MOBS && now - this.lastSpawnTime > this.spawnInterval) {
      this.attemptSpawn(playerPos);
      this.lastSpawnTime = now + Math.random() * 5000; 
    }
  }

  private attemptSpawn(playerPos: THREE.Vector3) {
    // Try 10 times to find a valid spot
    for (let i = 0; i < 10; i++) {
        // Random angle
        const angle = Math.random() * Math.PI * 2;
        // Random distance 20-40
        const dist = 20 + Math.random() * 20;
        
        const x = Math.floor(playerPos.x + Math.sin(angle) * dist);
        const z = Math.floor(playerPos.z + Math.cos(angle) * dist);
        
        // Check height
        // Since World.getHeight logic might be complex or chunk-based,
        // we can just scan downwards from a reasonable height (e.g. 255 or playerHeight + 20)
        // Or if World has a direct helper, use that.
        // Assuming we need to implement a simple scanner here if world.getHeight doesn't exist yet.
        
        const y = this.findSurfaceY(x, z);
        
        if (y !== -1) {
            // Found valid ground
            const zombie = new Zombie(this.world, this.scene, x, y + 1, z);
            this.mobs.push(zombie);
            // console.log(`Spawned Zombie at ${x}, ${y+1}, ${z}`);
            break; // Spawned one, stop trying
        }
    }
  }

  private findSurfaceY(x: number, z: number): number {
      // Find highest block at x,z
      // Start checking from somewhat high up. Max terrain height is usually ~30-40 based on generation settings
      // TERRAIN_HEIGHT=8, OFFSET=4, plus some hills... let's check from 50 down.
      for (let y = 50; y > 0; y--) {
          if (this.world.hasBlock(x, y, z)) {
              // Ensure space above is free (2 blocks)
              if (!this.world.hasBlock(x, y + 1, z) && !this.world.hasBlock(x, y + 2, z)) {
                  return y;
              }
              // If space above not free, this spot is invalid (e.g. under a tree or in a cave)
              return -1;
          }
      }
      return -1;
  }

  private despawnMob(index: number) {
    const mob = this.mobs[index];
    this.scene.remove(mob.mesh);
    // Dispose geometry/materials if needed, but we reuse the global noiseTexture.
    // However, Mob creates unique materials for parts.
    // In a real engine we'd pool these, but for now just let GC handle it or manually traverse.
    // mob.dispose(); // Ideally Mob class should have a dispose method
    this.mobs.splice(index, 1);
  }
}
