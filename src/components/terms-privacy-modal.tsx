import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

const STORAGE_KEY = 'terms-privacy-accepted';

function getInitialOpenState(): boolean {
  if (typeof window === 'undefined') return false;
  const accepted = localStorage.getItem(STORAGE_KEY);
  return !accepted;
}

interface TermsPrivacyModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
}

export function TermsPrivacyModal({
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
}: TermsPrivacyModalProps = {}) {
  const [internalOpen, setInternalOpen] = useState(showTrigger ? getInitialOpenState : false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? onOpenChange! : setInternalOpen;

  const handleAccept = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>Terms of Service & Privacy Policy</DialogTitle>
          <DialogDescription>
            Please read and accept to continue using Chronoline
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto my-4 pr-2 -mr-2">
          <div className="space-y-4 text-sm">
            <section>
              <h3 className="font-semibold text-base mb-2">Privacy First</h3>
              <p className="text-muted-foreground leading-relaxed">
                <strong className="text-foreground">
                  Your data never leaves your browser.
                </strong>{' '}
                All your timeline data is stored locally in your browser using
                IndexedDB. We do not collect, transmit, or store any of your
                data on our servers.
              </p>
            </section>

            <Separator />

            <section>
              <h3 className="font-semibold text-base mb-2">Data Storage</h3>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>All data is stored locally in your browser</li>
                <li>No account or login required</li>
                <li>No data is sent to any external servers</li>
                <li>You can export your data anytime</li>
                <li>
                  Clearing browser data will remove all your timelines (please
                  backup regularly)
                </li>
              </ul>
            </section>

            <Separator />

            <section>
              <h3 className="font-semibold text-base mb-2">
                Terms of Service
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                By using Chronoline, you agree to use this tool responsibly.
                This is provided as-is without warranties. You are responsible
                for backing up your own data.
              </p>
            </section>

            <Separator />

            <section>
              <h3 className="font-semibold text-base mb-2">Open Source</h3>
              <p className="text-muted-foreground leading-relaxed">
                Chronoline is designed to be shareable and self-hostable. See
                the project repository for source, licensing, and contribution
                details.
              </p>
            </section>
          </div>
        </div>

        <DialogFooter className="shrink-0 pt-4 border-t">
          <Button onClick={handleAccept} className="w-full sm:w-auto">
            I Understand & Accept
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
