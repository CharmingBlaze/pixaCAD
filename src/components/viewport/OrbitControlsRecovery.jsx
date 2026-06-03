import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';

/**
 * Re-enables orbit/pan after any pointer release when the viewport should allow navigation.
 * Guards against TransformControls leaving OrbitControls disabled after grouped-object edits.
 * @param {{ orbitEnabled: boolean }} props
 */
export function OrbitControlsRecovery({ orbitEnabled }) {
  const controls = useThree((s) => s.controls);

  useEffect(() => {
    if (!controls) return undefined;

    const release = () => {
      controls.enabled = orbitEnabled;
    };

    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);

    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      if (orbitEnabled) controls.enabled = true;
    };
  }, [controls, orbitEnabled]);

  return null;
}
