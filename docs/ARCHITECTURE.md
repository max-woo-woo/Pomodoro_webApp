# Architecture du Projet Pomodoro

## Structure des Dossiers
```
src/
├── components/     # Composants réutilisables
├── hooks/         # Hooks personnalisés pour la logique
├── config/        # Configuration et constantes
└── docs/          # Documentation du projet
```

## Principes Architecturaux

1. **Séparation des Responsabilités**
   - La logique métier est dans les hooks personnalisés
   - L'interface utilisateur est dans les composants
   - La configuration est centralisée

2. **État de l'Application**
   - Gestion locale du timer avec `useTimer`
   - Persistance des données avec IndexedDB via `useIndexedDB`
   - Pas de gestionnaire d'état global (non nécessaire pour cette taille d'application)

3. **Composants**
   - Composants fonctionnels React
   - Props bien définies
   - Responsabilité unique par composant

4. **Persistence**
   - Utilisation d'IndexedDB pour le stockage local
   - Structure de données simple pour les sessions
   - Pas de serveur nécessaire