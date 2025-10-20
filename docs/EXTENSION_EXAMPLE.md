# Exemple d'Extension : Ajout d'une Notification Sonore

Ce guide montre comment ajouter une nouvelle fonctionnalité en suivant l'architecture existante.

## 1. Ajouter la Configuration
```javascript
// Dans src/config/constants.js
export const POMODORO_CONFIG = {
  // ... configurations existantes
  NOTIFICATION_SOUND_URL: '/sounds/notification.mp3',
  NOTIFICATION_ENABLED: true
};
```

## 2. Créer un Nouveau Hook
```javascript
// src/hooks/useNotification.js
import { POMODORO_CONFIG } from '../config/constants';

export const useNotification = () => {
  const audio = new Audio(POMODORO_CONFIG.NOTIFICATION_SOUND_URL);

  const playNotification = () => {
    if (POMODORO_CONFIG.NOTIFICATION_ENABLED) {
      audio.play().catch(console.error);
    }
  };

  return { playNotification };
};
```

## 3. Intégrer dans useTimer
```javascript
// Dans src/hooks/useTimer.js
import { useNotification } from './useNotification';

export const useTimer = (onComplete) => {
  const { playNotification } = useNotification();

  useEffect(() => {
    if (timeLeft === 0) {
      playNotification();
      onComplete();
    }
  }, [timeLeft]);
  
  // ... reste du code
};
```

Cette approche :
1. Suit l'architecture existante
2. Isole la nouvelle fonctionnalité
3. Maintient la séparation des responsabilités
4. Facilite la désactivation/modification future