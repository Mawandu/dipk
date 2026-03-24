# Guide de Configuration Mobile (Android)

Pour compiler l'application React Native, tu as besoin du JDK (Java) et du SDK Android. Voici les étapes manuelles à suivre.

## 1. Installer Java (JDK 17)
React Native et Gradle nécessitent Java 17.
Ouvre un terminal et lance :
```bash
sudo apt update
sudo apt install -y openjdk-17-jdk adb
```

Vérifie l'installation :
```bash
java -version
```

## 2. Installer le SDK Android
Le plus simple est d'installer **Android Studio** qui installe tout automatiquement.

1.  Télécharge Android Studio : https://developer.android.com/studio
2.  Extrait l'archive et lance le script `studio.sh` (dans `android-studio/bin`).
3.  Suis l'assistant d'installation (Standard Setup). Cela téléchargera le **Android SDK**.
    *   Note le chemin d'installation du SDK (souvent `/home/ton_user/Android/Sdk`).

## 3. Configurer les variables d'environnement
Crée un fichier `local.properties` dans le dossier android de l'application pour indiquer où est le SDK.

Je vais le faire pour toi si tu me donnes le chemin, mais par défaut c'est souvent :
`/home/hamba/Android/Sdk`

Une fois Android Studio installé, tu dois accepter les licences SDK via l'interface ou en ligne de commande.

## 4. Configurer l'Émulateur ou Connexion USB
*   **Via Android Studio** : Ouvre "Device Manager" et crée un émulateur.
*   **Via USB** : Active le "Débogage USB" sur ton téléphone et branche-le. Vérifie avec `adb devices`.

## Résumé pour relancer
Une fois tout installé :
```bash
cd mobile_app
npm run android
```
