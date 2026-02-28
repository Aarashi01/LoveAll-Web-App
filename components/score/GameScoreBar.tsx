import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { type ScoreGame } from '@/lib/firestore/types';

type GameScoreBarProps = {
    scores: ScoreGame[];
    activeGameIndex: number;
    /** Number of games to win the match (e.g. 2 for best-of-3) */
    gamesToWin: number;
};

export function GameScoreBar({ scores, activeGameIndex, gamesToWin }: GameScoreBarProps) {
    if (scores.length === 0) return null;

    return (
        <View style={styles.container}>
            {scores.map((game, index) => {
                const isActive = index === activeGameIndex && game.winner === null;
                const isCompleted = game.winner !== null;

                return (
                    <View
                        key={game.gameNumber}
                        style={[
                            styles.pill,
                            isActive && styles.pillActive,
                            isCompleted && styles.pillCompleted,
                        ]}
                    >
                        <Text style={[styles.gameLabel, isActive && styles.gameLabelActive]}>
                            G{game.gameNumber}
                        </Text>
                        {isCompleted ? (
                            <Text style={styles.scoreText}>
                                {game.p1Score}-{game.p2Score}
                            </Text>
                        ) : isActive ? (
                            <Text style={[styles.scoreText, styles.scoreTextActive]}>
                                {game.p1Score}-{game.p2Score}
                            </Text>
                        ) : (
                            <Text style={styles.pendingText}>—</Text>
                        )}
                    </View>
                );
            })}

            {/* Show total games won */}
            <View style={styles.winsContainer}>
                <View style={styles.winDot}>
                    <Text style={styles.winText}>
                        {scores.filter((g) => g.winner === 'p1').length}
                    </Text>
                </View>
                <Text style={styles.winsDivider}>-</Text>
                <View style={styles.winDot}>
                    <Text style={styles.winText}>
                        {scores.filter((g) => g.winner === 'p2').length}
                    </Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 4,
        flexWrap: 'wrap',
    },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: 'rgba(30, 41, 59, 0.6)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    pillActive: {
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        borderColor: 'rgba(59, 130, 246, 0.4)',
        ...(typeof window !== 'undefined' && {
            boxShadow: '0 0 12px rgba(59, 130, 246, 0.2)',
        }),
    },
    pillCompleted: {
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderColor: 'rgba(16, 185, 129, 0.25)',
    },
    gameLabel: {
        color: '#64748B',
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    gameLabelActive: {
        color: '#60A5FA',
    },
    scoreText: {
        color: '#CBD5E1',
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: -0.5,
    },
    scoreTextActive: {
        color: '#F8FAFC',
    },
    pendingText: {
        color: '#475569',
        fontSize: 14,
        fontWeight: '700',
    },
    winsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginLeft: 4,
    },
    winDot: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(248, 250, 252, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    winText: {
        color: '#F8FAFC',
        fontSize: 13,
        fontWeight: '900',
    },
    winsDivider: {
        color: '#475569',
        fontSize: 14,
        fontWeight: '700',
    },
});
