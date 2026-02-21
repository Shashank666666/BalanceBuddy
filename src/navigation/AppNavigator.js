import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import {
    View, Text, TouchableOpacity, StyleSheet, Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { COLORS, RADIUS, FONTS, SPACING } from '../constants/theme';

import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import TripsScreen from '../screens/TripsScreen';
import ActivityScreen from '../screens/ActivityScreen';
import ProfileScreen from '../screens/ProfileScreen';
import CreateTripScreen from '../screens/CreateTripScreen';
import TripDetailScreen from '../screens/TripDetailScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import CurrencyConverterScreen from '../screens/CurrencyConverterScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Create a custom dark theme to prevent white flas
const AppTheme = {
    ...DefaultTheme,
    colors: {
        ...DefaultTheme.colors,
        background: '#020617', // Midnight Ocean background
    },
};

function CustomTabBar({ state, descriptors, navigation }) {
    const tabs = [
        { name: 'Home', icon: 'home', label: 'Home' },
        { name: 'Trips', icon: 'map-outline', label: 'Trips' },
        { name: 'Activity', icon: 'time-outline', label: 'Activity' },
        { name: 'Profile', icon: 'person-outline', label: 'Profile' },
    ];

    return (
        <View style={styles.tabBarWrapper}>
            <View style={styles.tabBar}>
                {state.routes.map((route, index) => {
                    const isFocused = state.index === index;
                    const tab = tabs[index];
                    const midIndex = Math.floor(tabs.length / 2);

                    return (
                        <React.Fragment key={route.key}>
                            {index === midIndex && (
                                <TouchableOpacity
                                    style={styles.fabWrapper}
                                    onPress={() => navigation.navigate('CreateTrip')}
                                    activeOpacity={0.85}
                                >
                                    <LinearGradient
                                        colors={['#0EA5E9', '#2DD4BF']}
                                        style={styles.fabBtn}
                                    >
                                        <Ionicons name="add" size={28} color="#fff" />
                                    </LinearGradient>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity
                                style={styles.tabItem}
                                onPress={() => {
                                    const event = navigation.emit({
                                        type: 'tabPress',
                                        target: route.key,
                                        canPreventDefault: true,
                                    });
                                    if (!event.defaultPrevented) {
                                        navigation.navigate(route.name);
                                    }
                                }}
                                activeOpacity={0.7}
                            >
                                <Ionicons
                                    name={isFocused ? tab.icon.replace('-outline', '') : tab.icon}
                                    size={22}
                                    color={isFocused ? COLORS.violet : COLORS.tabInactive}
                                />
                                <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>
                                    {tab.label}
                                </Text>
                                {isFocused && <View style={styles.tabActiveDot} />}
                            </TouchableOpacity>
                        </React.Fragment>
                    );
                })}
            </View>
        </View>
    );
}

function MainTabs() {
    return (
        <Tab.Navigator
            tabBar={(props) => <CustomTabBar {...props} />}
            screenOptions={{ headerShown: false }}
        >
            <Tab.Screen name="Home" component={HomeScreen} />
            <Tab.Screen name="Trips" component={TripsScreen} />
            <Tab.Screen name="Activity" component={ActivityScreen} />
            <Tab.Screen name="Profile" component={ProfileScreen} />
        </Tab.Navigator>
    );
}

export default function AppNavigator() {
    return (
        <NavigationContainer theme={AppTheme}>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen name="Onboarding" component={OnboardingScreen} />
                <Stack.Screen name="Login" component={LoginScreen} />
                <Stack.Screen name="MainTabs" component={MainTabs} />
                <Stack.Screen name="CreateTrip" component={CreateTripScreen} />
                <Stack.Screen name="TripDetail" component={TripDetailScreen} />
                <Stack.Screen name="EditProfile" component={EditProfileScreen} />
                <Stack.Screen name="CurrencyConverter" component={CurrencyConverterScreen} />
            </Stack.Navigator>
        </NavigationContainer>
    );
}

const styles = StyleSheet.create({
    tabBarWrapper: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingBottom: Platform.OS === 'ios' ? 20 : 4,
    },
    tabBar: {
        flexDirection: 'row',
        backgroundColor: 'rgba(2, 6, 23, 0.85)',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.05)',
        paddingTop: SPACING.sm,
        paddingBottom: SPACING.xs,
        paddingHorizontal: SPACING.sm,
        alignItems: 'flex-end',
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 4,
        position: 'relative',
    },
    tabLabel: {
        color: COLORS.tabInactive,
        fontSize: FONTS.sizes.xs,
        marginTop: 2,
        fontWeight: '500',
    },
    tabLabelActive: {
        color: COLORS.violet,
        fontWeight: '700',
    },
    tabActiveDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: COLORS.violet,
        marginTop: 2,
    },
    fabWrapper: {
        width: 62,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
    },
    fabBtn: {
        width: 58,
        height: 58,
        borderRadius: 29,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: COLORS.violet,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 10,
        marginBottom: 8,
    },
});
