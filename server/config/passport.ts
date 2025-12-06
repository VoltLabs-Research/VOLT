/**
 * Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 **/

import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as MicrosoftStrategy } from 'passport-microsoft';
import { User } from '@/models/index';

import { generateRandomName } from '@/utilities/runtime/name-generator';

/**
 * Configure GitHub OAuth Strategy
 */
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    passport.use(
        new GitHubStrategy(
            {
                clientID: process.env.GITHUB_CLIENT_ID,
                clientSecret: process.env.GITHUB_CLIENT_SECRET,
                callbackURL: process.env.GITHUB_CALLBACK_URL!,
                scope: ['user:email']
            },
            async (_accessToken: string, _refreshToken: string, profile: any, done: (error: any, user?: any) => void) => {
                try {
                    const email = profile.emails?.[0]?.value;
                    if (!email) {
                        return done(new Error('No email found in GitHub profile'), undefined);
                    }

                    // Check if user exists with this OAuth provider
                    let user = await User.findOne({
                        oauthProvider: 'github',
                        oauthId: profile.id
                    });

                    if (!user) {
                        // Check if user exists with this email
                        user = await User.findOne({ email });

                        if (user) {
                            // Link GitHub account to existing user
                            user.oauthProvider = 'github';
                            user.oauthId = profile.id;
                            user.avatar = profile.photos?.[0]?.value || user.avatar;
                            await user.save();
                        } else {
                            // Create new user
                            const { firstName, lastName } = generateRandomName(profile.id);
                            const names = profile.displayName?.split(' ') || [];

                            user = await User.create({
                                email,
                                firstName: names[0] || firstName,
                                lastName: names.slice(1).join(' ') || lastName,
                                oauthProvider: 'github',
                                oauthId: profile.id,
                                avatar: profile.photos?.[0]?.value
                            });
                        }
                    }

                    return done(null, user);
                } catch (error) {
                    return done(error as Error, undefined);
                }
            }
        )
    );
}

/**
 * Configure Google OAuth Strategy
 */
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
        new GoogleStrategy(
            {
                clientID: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                callbackURL: process.env.GOOGLE_CALLBACK_URL!,
                scope: ['profile', 'email']
            },
            async (_accessToken: string, _refreshToken: string, profile: any, done: (error: any, user?: any) => void) => {
                try {
                    const email = profile.emails?.[0]?.value;
                    if (!email) {
                        return done(new Error('No email found in Google profile'), undefined);
                    }

                    // Check if user exists with this OAuth provider
                    let user = await User.findOne({
                        oauthProvider: 'google',
                        oauthId: profile.id
                    });

                    if (!user) {
                        // Check if user exists with this email
                        user = await User.findOne({ email });

                        if (user) {
                            // Link Google account to existing user
                            user.oauthProvider = 'google';
                            user.oauthId = profile.id;
                            user.avatar = profile.photos?.[0]?.value || user.avatar;
                            await user.save();
                        } else {
                            // Create new user
                            const { firstName, lastName } = generateRandomName(profile.id);

                            user = await User.create({
                                email,
                                firstName: profile.name?.givenName || firstName,
                                lastName: profile.name?.familyName || lastName,
                                oauthProvider: 'google',
                                oauthId: profile.id,
                                avatar: profile.photos?.[0]?.value
                            });
                        }
                    }

                    return done(null, user);
                } catch (error) {
                    return done(error as Error, undefined);
                }
            }
        )
    );
}

/**
 * Configure Microsoft OAuth Strategy
 */
if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
    passport.use(
        new MicrosoftStrategy(
            {
                clientID: process.env.MICROSOFT_CLIENT_ID,
                clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
                callbackURL: process.env.MICROSOFT_CALLBACK_URL!,
                scope: ['user.read']
            },
            async (_accessToken: string, _refreshToken: string, profile: any, done: (error: any, user?: any) => void) => {
                try {
                    const email = profile.emails?.[0]?.value || profile._json?.mail || profile._json?.userPrincipalName;
                    if (!email) {
                        return done(new Error('No email found in Microsoft profile'), undefined);
                    }

                    // Check if user exists with this OAuth provider
                    let user = await User.findOne({
                        oauthProvider: 'microsoft',
                        oauthId: profile.id
                    });

                    if (!user) {
                        // Check if user exists with this email
                        user = await User.findOne({ email });

                        if (user) {
                            // Link Microsoft account to existing user
                            user.oauthProvider = 'microsoft';
                            user.oauthId = profile.id;
                            user.avatar = user.avatar; // Microsoft doesn't provide photo in basic scope
                            await user.save();
                        } else {
                            // Create new user
                            const { firstName, lastName } = generateRandomName(profile.id);

                            user = await User.create({
                                email,
                                firstName: profile.name?.givenName || firstName,
                                lastName: profile.name?.familyName || lastName,
                                oauthProvider: 'microsoft',
                                oauthId: profile.id
                            });
                        }
                    }

                    return done(null, user);
                } catch (error) {
                    return done(error as Error, undefined);
                }
            }
        )
    );
}

/**
 * Serialize user to session
 */
passport.serializeUser((user: any, done) => {
    done(null, user.id);
});

/**
 * Deserialize user from session
 */
passport.deserializeUser(async (id: string, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

export default passport;
