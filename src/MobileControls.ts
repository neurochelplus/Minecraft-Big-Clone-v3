// Mobile Controls Implementation
if (isMobile) {
  // Joystick Logic
  const joystickZone = document.getElementById('joystick-zone')!;
  const joystickStick = document.getElementById('joystick-stick')!;
  
  let stickStartX = 0;
  let stickStartY = 0;
  let isDraggingStick = false;
  
  joystickZone.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    stickStartX = touch.clientX;
    stickStartY = touch.clientY;
    isDraggingStick = true;
    
    // Move stick to touch start temporarily for visual feedback? 
    // No, standard is stick stays in center of zone, or zone follows finger. 
    // Let's keep stick in center of zone (relative to zone).
    // Actually, let's just use the zone center as the origin.
    const rect = joystickZone.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    stickStartX = centerX;
    stickStartY = centerY;
  });

  joystickZone.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!isDraggingStick) return;
    const touch = e.changedTouches[0];
    
    const dx = touch.clientX - stickStartX;
    const dy = touch.clientY - stickStartY;
    
    // Clamp stick visual
    const maxDist = 40;
    const distance = Math.sqrt(dx*dx + dy*dy);
    const clampedDist = Math.min(distance, maxDist);
    const angle = Math.atan2(dy, dx);
    
    const stickX = Math.cos(angle) * clampedDist;
    const stickY = Math.sin(angle) * clampedDist;
    
    joystickStick.style.transform = `translate(calc(-50% + ${stickX}px), calc(-50% + ${stickY}px))`;
    
    // Update movement flags
    // Thresholds
    const threshold = 10;
    
    moveForward = dy < -threshold;
    moveBackward = dy > threshold;
    moveLeft = dx < -threshold;
    moveRight = dx > threshold;
  });

  const resetStick = () => {
    isDraggingStick = false;
    joystickStick.style.transform = `translate(-50%, -50%)`;
    moveForward = false;
    moveBackward = false;
    moveLeft = false;
    moveRight = false;
  };

  joystickZone.addEventListener('touchend', resetStick);
  joystickZone.addEventListener('touchcancel', resetStick);

  // Buttons
  document.getElementById('btn-jump')!.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (isOnGround) {
        velocity.y = JUMP_IMPULSE;
        isOnGround = false;
    }
  });

  document.getElementById('btn-attack')!.addEventListener('touchstart', (e) => {
    e.preventDefault();
    performAttack();
  });

  document.getElementById('btn-place')!.addEventListener('touchstart', (e) => {
    e.preventDefault();
    performInteract();
  });
  
  document.getElementById('btn-inv')!.addEventListener('touchstart', (e) => {
      e.preventDefault();
      toggleInventory();
  });

  // Camera Look (Touch Drag on background)
  let lastLookX = 0;
  let lastLookY = 0;
  
  document.addEventListener('touchstart', (e) => {
    // Only if not on a UI element that stops propagation
    // But we need to filter explicitly or ensure UI elements stop prop.
    // The joystick and buttons stop prop or prevent default.
    // However, the event might bubble.
    // Check target.
    const target = e.target as HTMLElement;
    if (target.closest('#joystick-zone') || target.closest('.mob-btn') || target.closest('#inventory-menu') || target.closest('#hotbar')) return;
    
    const touch = e.changedTouches[0];
    lastLookX = touch.clientX;
    lastLookY = touch.clientY;
  });

  document.addEventListener('touchmove', (e) => {
     const target = e.target as HTMLElement;
    if (target.closest('#joystick-zone') || target.closest('.mob-btn') || target.closest('#inventory-menu') || target.closest('#hotbar')) return;

    const touch = e.changedTouches[0];
    const dx = touch.clientX - lastLookX;
    const dy = touch.clientY - lastLookY;
    
    lastLookX = touch.clientX;
    lastLookY = touch.clientY;
    
    // Sensitivity
    const SENSITIVITY = 0.005;
    
    // Rotate Camera
    // Yaw (Y axis) - rotates the player body (controls.object)
    controls.object.rotation.y -= dx * SENSITIVITY;
    
    // Pitch (X axis) - rotates the camera
    camera.rotation.x -= dy * SENSITIVITY;
    camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));
  });

  // Fullscreen Prompt
  const btnStart = document.getElementById('btn-start-mobile')!;
  const fsPrompt = document.getElementById('fs-prompt')!;
  
  btnStart.addEventListener('touchstart', () => {
    document.documentElement.requestFullscreen().catch(err => {
        console.log("Fullscreen denied", err);
    });
    fsPrompt.style.display = 'none';
  });
}
