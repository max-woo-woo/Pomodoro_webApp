# Journal des Changements

## [2025-10-11] Restructuration Majeure pour Amélioration de la Maintenabilité

### Changements Effectués

1. **Création de Hooks Personnalisés**
   - `useTimer` : Extrait la logique du timer
   - `useIndexedDB` : Isole la gestion de la base de données
   - Raison : Séparation des préoccupations et réutilisabilité du code

2. **Création de Composants Réutilisables**
   - `TimerDisplay` : Affichage du temps
   - `Controls` : Boutons de contrôle
   - `SessionCounter` : Affichage des sessions
   - Raison : Composants plus petits et plus faciles à maintenir

3. **Centralisation de la Configuration**
   - Création de `constants.js`
   - Paramètres du Pomodoro centralisés
   - Configuration de la base de données
   - Raison : Faciliter les modifications futures des paramètres

### Structure des Fichiers

```
src/
├── components/TimerComponents.jsx  # Composants d'interface
├── hooks/
│   ├── useTimer.js                # Logique du timer
│   └── useIndexedDB.js            # Gestion de la BD
├── config/
│   └── constants.js               # Configuration
└── App.jsx                        # Point d'entrée
```

### Détails Techniques

1. **useTimer.js**
   - Gestion du décompte
   - Formatage du temps
   - Contrôles (start/pause/reset)
   - Callback de fin de session

2. **useIndexedDB.js**
   - Initialisation de la BD
   - Sauvegarde des sessions
   - Chargement du compteur
   - Gestion des erreurs

3. **constants.js**
   - Durée par défaut : 25 minutes
   - Configuration IndexedDB
   - Noms des stores et version

### Points d'Extension Futurs

1. **Fonctionnalités Potentielles**
   - Personnalisation de la durée
   - Sons de notification
   - Statistiques des sessions
   - Thèmes visuels

2. **Comment Étendre**
   - Ajouter des paramètres dans `constants.js`
   - Créer de nouveaux hooks si nécessaire
   - Étendre les composants existants
   - Ajouter de nouveaux composants

## [2025-10-20] Ajustements audio et persistance pour tests

### Changements Effectués

1. **Bip audio rendu plus audible et plus long**
    - Fonction `playBeep()` (dans `src/App.jsx`) : enveloppe ADSR ajustée, pic de gain augmenté et durée prolongée (~1.2s) pour un retour plus perceptible.
    - Oscillateur : type `triangle` conservé pour un son doux, fréquence légèrement abaissée pour un timbre plus chaud.

2. **AudioContext persistant et initialisé sur interaction**
    - `AudioContext` maintenant stocké dans `audioCtxRef` et créé/activé lors du premier geste utilisateur (clic Start) pour éviter les blocages de lecture audio par le navigateur.

3. **Corrections et améliorations liées aux sessions**
    - Ajout de `clearSessions()` dans le hook `useIndexedDB` et bouton de test "Clear sessions" sur l'écran d'accueil.
    - Correction d'un bug où la callback de fin de timer (`onComplete`) pouvait être appelée plusieurs fois : garde locale ajoutée dans `useTimer`.

4. **Mode de test temporaire**
    - `DEFAULT_MINUTES` réglé temporairement sur ~0.1667 (10s) pour faciliter les tests rapides. Revenir à 25 minutes avant production.

### Fichiers modifiés

- `src/App.jsx` : `playBeep()` (audio), AudioContext gestion, UI "Clear sessions".
- `src/hooks/useIndexedDB.js` : ajout de `clearSessions()`.
- `src/hooks/useTimer.js` : garde pour éviter doubles appels `onComplete`.
- `src/config/constants.js` : durée par défaut temporairement définie sur 10s pour tests.

### Notes

- Si vous préférez un son différent (fichier wav/mp3), il est recommandé d'ajouter le fichier dans `public/` et de le jouer via `AudioBuffer` pour une latence adaptée.
- Penser à remettre `DEFAULT_MINUTES` à 25 minutes avant déploiement en production.