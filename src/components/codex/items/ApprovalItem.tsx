import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApprovalStore } from '@/components/codex/stores';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function ApprovalItem() {
  const { currentApproval, pendingApprovals, respondToApproval } = useApprovalStore();
  const [showDetails, setShowDetails] = useState(false);
  const { t } = useTranslation('thread');

  if (!currentApproval) return null;

  const isCommandExecution = currentApproval.type === 'commandExecution';

  const handleApprove = async () => {
    try {
      let decision: any = 'accept';
      if (
        currentApproval.type === 'commandExecution' &&
        currentApproval.proposedExecpolicyAmendment
      ) {
        decision = {
          acceptWithExecpolicyAmendment: {
            execpolicy_amendment: currentApproval.proposedExecpolicyAmendment,
          },
        };
      }
      await respondToApproval(currentApproval.requestId, isCommandExecution, decision);
    } catch (error) {
      console.error('Failed to approve:', error);
    }
  };

  const handleApproveForSession = async () => {
    try {
      await respondToApproval(currentApproval.requestId, isCommandExecution, 'acceptForSession');
    } catch (error) {
      console.error('Failed to approve for session:', error);
    }
  };

  const handleDecline = async () => {
    try {
      await respondToApproval(currentApproval.requestId, isCommandExecution, 'decline');
    } catch (error) {
      console.error('Failed to decline:', error);
    }
  };

  return (
    <div className="rounded-md border bg-background p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-warning" />
          <span className="font-medium">{t('approval.title')}</span>
          {pendingApprovals.length > 1 && (
            <Badge variant="secondary">
              {t('common.pending', { count: pendingApprovals.length })}
            </Badge>
          )}
        </div>
        {currentApproval.reason && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
            className="h-7"
          >
            {showDetails ? (
              <>
                <ChevronUp className="w-4 h-4 mr-1" />
                {t('approval.hideDetails')}
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 mr-1" />
                {t('approval.showDetails')}
              </>
            )}
          </Button>
        )}
      </div>

      {/* Main info - always visible */}
      <div className="grid gap-3 text-sm">
        {currentApproval.type === 'commandExecution' && (
          <div>
            <div className="font-medium mb-1">{t('approval.commandRequest')}</div>
            <div className="text-muted-foreground p-2 bg-muted rounded font-mono text-xs break-all">
              itemId: {currentApproval.itemId}
            </div>
          </div>
        )}

        {currentApproval.type === 'fileChange' && currentApproval.grantRoot && (
          <div>
            <div className="font-medium mb-1">{t('approval.fileRequest')}</div>
            <div className="text-muted-foreground p-2 bg-muted rounded">
              <div className="text-xs mb-1">{t('approval.allowWritesUnder')}</div>
              <div className="font-mono text-xs break-all">{currentApproval.grantRoot}</div>
            </div>
          </div>
        )}

        {currentApproval.type === 'commandExecution' &&
          currentApproval.proposedExecpolicyAmendment && (
            <div>
              <div className="font-medium mb-1 flex items-center gap-2">
                <span>{t('approval.policyAmendment')}</span>
                <Badge variant="secondary" className="text-xs">
                  {t('approval.skipFutureApprovals')}
                </Badge>
              </div>
              <div className="text-muted-foreground p-2 bg-muted rounded font-mono text-xs break-all">
                {currentApproval.proposedExecpolicyAmendment.join(' ')}
              </div>
            </div>
          )}
      </div>

      {/* Collapsible details */}
      {showDetails && (
        <div className="grid gap-3 text-sm pt-2 border-t">
          {currentApproval.reason && (
            <div>
              <div className="font-medium mb-1">{t('approval.reason')}</div>
              <div className="text-muted-foreground p-2 bg-muted rounded text-xs">
                {currentApproval.reason}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-2 pt-2">
        <Button variant="outline" onClick={handleDecline} className="flex-1">
          {t('common.decline')}
        </Button>
        <Button variant="secondary" onClick={handleApproveForSession} className="flex-1">
          {t('approval.approveForSession')}
        </Button>
        <Button onClick={handleApprove} className="flex-1">
          {t('approval.approveOnce')}
        </Button>
      </div>
    </div>
  );
}
