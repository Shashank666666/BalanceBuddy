import React, { createContext, useState, useEffect, useContext } from 'react';
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    GoogleAuthProvider,
    signInWithCredential
} from 'firebase/auth';
import { auth, db } from '../config/firebase';
import { doc, setDoc, getDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
            if (authUser) {
                // Fetch initial user data
                const userDoc = await getDoc(doc(db, 'users', authUser.uid));
                const userData = userDoc.exists() ? userDoc.data() : {};
                setUser({ ...authUser, ...userData });

                // Subscribe to real-time updates for the user document
                const userRef = doc(db, 'users', authUser.uid);
                const unsubDoc = onSnapshot(userRef, (doc) => {
                    if (doc.exists()) {
                        setUser(prev => ({ ...prev, ...doc.data() }));
                    }
                });

                return () => {
                    unsubDoc();
                };
            } else {
                setUser(null);
            }
            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const saveUserToFirestore = async (user, additionalData = {}) => {
        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || additionalData.displayName || '',
            photoURL: user.photoURL || '',
            createdAt: serverTimestamp(),
            lastLogin: serverTimestamp(),
            ...additionalData
        }, { merge: true });
    };

    const login = async (email, password) => {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        await saveUserToFirestore(userCredential.user);
        return userCredential;
    };

    const signup = async (email, password, displayName = '') => {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await saveUserToFirestore(userCredential.user, { displayName });
        return userCredential;
    };

    const logout = () => {
        return signOut(auth);
    };

    const loginWithGoogle = async (idToken) => {
        const credential = GoogleAuthProvider.credential(idToken);
        const userCredential = await signInWithCredential(auth, credential);
        await saveUserToFirestore(userCredential.user);
        return userCredential;
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, signup, logout, loginWithGoogle }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
