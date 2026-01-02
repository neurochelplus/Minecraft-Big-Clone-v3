import { Environment } from './Environment';

export function initDebugControls(environment: Environment) {
    window.addEventListener('keydown', (event) => {
        // Only trigger if not typing in an input (though we don't have inputs yet, good practice)
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

        switch (event.code) {
            case 'KeyK':
                console.log('Debug: Setting time to Night');
                environment.setTimeToNight();
                break;
            case 'KeyL':
                console.log('Debug: Setting time to Day');
                environment.setTimeToDay();
                break;
        }
    });
}
