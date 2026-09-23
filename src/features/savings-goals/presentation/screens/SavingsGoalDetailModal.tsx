import React from 'react';
import {
  View,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { AppText } from '@/core/ui/components/AppText';
import { AppButton } from '@/core/ui/components/AppButton';
import { SavingsGoalProgress } from '../../domain/savings-goal-progress';
import { theme } from '@/core/ui/tokens/theme';

export interface SavingsGoalDetailModalProps {
  visible: boolean;
  goalProgress: SavingsGoalProgress | null;
  onClose: () => void;
  onEditPress: (goal: SavingsGoalProgress) => void;
  onDeletePress: (goalId: string) => void;
}

export const SavingsGoalDetailModal: React.FC<SavingsGoalDetailModalProps> = ({
  visible,
  goalProgress,
  onClose,
  onEditPress,
  onDeletePress,
}) => {
  if (!goalProgress) return null;

  const { goal, currentAmount, targetAmount, remainingAmount, percentageCompleted, isCompleted } =
    goalProgress;

  const handleDelete = () => {
    Alert.alert(
      'Hapus Target Tabungan',
      `Apakah Anda yakin ingin menghapus target "${goal.name}"?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: () => {
            onClose();
            onDeletePress(goal.id);
          },
        },
      ]
    );
  };

  const milestones = [
    { label: '25% - Permulaan', pct: 25 },
    { label: '50% - Setengah Jalan', pct: 50 },
    { label: '75% - Hampir Tercapai', pct: 75 },
    { label: '100% - Target Tercapai 🎉', pct: 100 },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <AppText variant="titleMedium" style={styles.icon}>
                🎯
              </AppText>
              <View>
                <AppText variant="titleMedium" style={styles.title}>
                  {goal.name}
                </AppText>
                <AppText variant="caption" style={styles.subtitle}>
                  Target Tabungan
                </AppText>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Tutup">
              <AppText style={styles.closeText}>✕</AppText>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent}>
            {/* Status Badge */}
            <View style={styles.badgeRow}>
              {isCompleted ? (
                <View style={styles.completedBadge}>
                  <AppText variant="caption" style={styles.completedText}>
                    🎉 TARGET TERCAPAI
                  </AppText>
                </View>
              ) : (
                <View style={styles.activeBadge}>
                  <AppText variant="caption" style={styles.activeText}>
                    DALAM PROGRES ({percentageCompleted.toFixed(1)}%)
                  </AppText>
                </View>
              )}
            </View>

            {/* Financial Overview Card */}
            <View style={styles.card}>
              <View style={styles.row}>
                <View style={styles.col}>
                  <AppText variant="caption" style={styles.label}>
                    Terkumpul
                  </AppText>
                  <AppText variant="titleMedium" style={styles.currentValue}>
                    {currentAmount.formatDisplay()}
                  </AppText>
                </View>
                <View style={styles.colRight}>
                  <AppText variant="caption" style={styles.label}>
                    Total Target
                  </AppText>
                  <AppText variant="titleMedium" style={styles.targetValue}>
                    {targetAmount.formatDisplay()}
                  </AppText>
                </View>
              </View>

              {/* Progress Bar */}
              <View style={styles.progressBarBg}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${Math.min(100, Math.max(0, percentageCompleted))}%`,
                      backgroundColor: isCompleted ? theme.colors.success[500] : theme.colors.primary[500],
                    },
                  ]}
                />
              </View>
              <AppText variant="caption" style={styles.progressText}>
                {isCompleted
                  ? 'Selamat! Target tabungan ini telah terpenuhi.'
                  : `Kurang ${remainingAmount.formatDisplay()} lagi untuk mencapai target.`}
              </AppText>

              {goal.targetDate ? (
                <View style={styles.metaRow}>
                  <AppText variant="caption" style={styles.metaLabel}>
                    🗓️ Target Waktu:
                  </AppText>
                  <AppText variant="caption" style={styles.metaValue}>
                    {goal.targetDate}
                  </AppText>
                </View>
              ) : null}
            </View>

            {/* Milestones Progress Timeline */}
            <View style={styles.milestoneSection}>
              <AppText variant="caption" style={styles.sectionTitle}>
                PENCAPAIAN TONGGAK (MILESTONES)
              </AppText>

              {milestones.map((m) => {
                const reached = percentageCompleted >= m.pct;
                return (
                  <View key={m.pct} style={styles.milestoneRow}>
                    <View
                      style={[
                        styles.milestoneDot,
                        reached && styles.milestoneDotReached,
                      ]}
                    >
                      <AppText variant="caption" style={styles.milestoneCheck}>
                        {reached ? '✓' : '○'}
                      </AppText>
                    </View>
                    <View style={styles.milestoneContent}>
                      <AppText
                        variant="body"
                        style={[
                          styles.milestoneText,
                          reached && styles.milestoneTextReached,
                        ]}
                      >
                        {m.label}
                      </AppText>
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <AppButton
              title="✏️ Edit Target"
              variant="secondary"
              onPress={() => {
                onClose();
                onEditPress(goalProgress);
              }}
              style={styles.actionBtn}
            />
            <AppButton
              title="🗑️ Hapus"
              variant="danger"
              onPress={handleDelete}
              style={styles.actionBtn}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radii.lg,
    borderTopRightRadius: theme.radii.lg,
    maxHeight: '90%',
    paddingBottom: theme.spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  icon: {
    fontSize: 24,
  },
  title: {
    fontWeight: theme.typography.fontWeights.bold,
  },
  subtitle: {
    color: theme.colors.textMuted,
  },
  closeText: {
    fontSize: 18,
    color: theme.colors.textMuted,
    paddingHorizontal: theme.spacing.xs,
  },
  scrollContent: {
    padding: theme.spacing.md,
  },
  badgeRow: {
    marginBottom: theme.spacing.md,
  },
  completedBadge: {
    backgroundColor: theme.colors.success[50],
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radii.sm,
    alignSelf: 'flex-start',
  },
  completedText: {
    color: theme.colors.success[700],
    fontWeight: theme.typography.fontWeights.bold,
  },
  activeBadge: {
    backgroundColor: theme.colors.primary[50],
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radii.sm,
    alignSelf: 'flex-start',
  },
  activeText: {
    color: theme.colors.primary[700],
    fontWeight: theme.typography.fontWeights.bold,
  },
  card: {
    backgroundColor: theme.colors.surfaceSubtle,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  col: {
    flex: 1,
  },
  colRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  label: {
    color: theme.colors.textMuted,
    marginBottom: 2,
  },
  currentValue: {
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.primary[600],
  },
  targetValue: {
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.text,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: theme.colors.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: theme.spacing.xs,
    marginBottom: 4,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginBottom: theme.spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  metaLabel: {
    color: theme.colors.textMuted,
  },
  metaValue: {
    fontWeight: theme.typography.fontWeights.semibold,
  },
  milestoneSection: {
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    color: theme.colors.textMuted,
    fontWeight: '700',
    marginBottom: theme.spacing.sm,
    letterSpacing: 0.5,
  },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
    gap: theme.spacing.sm,
  },
  milestoneDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  milestoneDotReached: {
    backgroundColor: theme.colors.success[500],
    borderColor: theme.colors.success[500],
  },
  milestoneCheck: {
    color: theme.colors.white,
    fontWeight: '700',
    fontSize: 12,
  },
  milestoneContent: {
    flex: 1,
  },
  milestoneText: {
    color: theme.colors.textMuted,
  },
  milestoneTextReached: {
    color: theme.colors.text,
    fontWeight: theme.typography.fontWeights.semibold,
  },
  footer: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  actionBtn: {
    flex: 1,
  },
});
