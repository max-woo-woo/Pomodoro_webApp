# Guide de Développement

## Principes de Base

1. **Isolation des Responsabilités**
   - La logique va dans les hooks
   - L'interface va dans les composants
   - La configuration va dans constants.js

2. **Modification du Code**
   - Toujours commenter les changements complexes
   - Mettre à jour la documentation si nécessaire
   - Tester les changements avant de commit

## Comment Ajouter des Fonctionnalités

### 1. Ajouter une Configuration
```javascript
// Dans src/config/constants.js
export const POMODORO_CONFIG = {
  // Ajouter ici les nouvelles constantes
  NEW_FEATURE_CONFIG: value
};
```

### 2. Étendre un Hook
```javascript
// Dans le hook approprié
const useHook = () => {
  // Ajouter les nouveaux états
  const [newState, setNewState] = useState(initial);

  // Ajouter les nouvelles fonctions
  const newFunction = () => {
    // Logique
  };

  return {
    // Retourner les nouvelles valeurs
    newState,
    newFunction
  };
};
```

### 3. Créer un Composant
```jsx
// Dans src/components/
export const NewComponent = ({ prop1, prop2 }) => (
  <div>
    // Interface utilisateur
  </div>
);
```

## Bonnes Pratiques

1. **Hooks**
   - Un hook = une responsabilité
   - Documenter les paramètres et retours
   - Gérer les erreurs

2. **Composants**
   - Props bien typées
   - Pas de logique complexe
   - Styles dans App.css

3. **IndexedDB**
   - Toujours gérer les erreurs
   - Transactions courtes
   - Vérifier la compatibilité