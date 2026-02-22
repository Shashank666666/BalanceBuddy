import React, { createContext, useState, useEffect, useContext } from 'react';
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
} from 'firebase/auth';
import { auth, db } from '../config/firebase';
import { doc, setDoc, getDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let unsubDoc = null;

        const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
            // Clean up previous document listener if it exists
            if (unsubDoc) {
                unsubDoc();
                unsubDoc = null;
            }

            if (authUser) {
                try {
                    // Fetch initial user data
                    const userDoc = await getDoc(doc(db, 'users', authUser.uid));
                    const userData = userDoc.exists() ? userDoc.data() : {};

                    // Set initial user state with a clean object
                    const cleanUser = {
                        uid: authUser.uid,
                        email: authUser.email,
                        displayName: authUser.displayName,
                        photoURL: authUser.photoURL,
                        ...userData
                    };
                    setUser(cleanUser);

                    // Subscribe to real-time updates for the user document
                    const userRef = doc(db, 'users', authUser.uid);
                    unsubDoc = onSnapshot(userRef, (doc) => {
                        if (doc.exists()) {
                            setUser(prev => prev ? ({ ...prev, ...doc.data() }) : null);
                        }
                    }, (error) => {
                        console.error("User doc snapshot error:", error);
                    });
                } catch (error) {
                    console.error("Error initializing user state:", error);
                    setUser(null);
                }
            } else {
                setUser(null);
            }
            setLoading(false);
        });

        return () => {
            unsubscribe();
            if (unsubDoc) unsubDoc();
        };
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

    return (
        <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
