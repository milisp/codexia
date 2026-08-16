#import <UIKit/UIKit.h>
#import <objc/runtime.h>

// WKWebView hosts text inputs inside a private WKContentView whose
// inputAccessoryView is the Safari-style form navigation bar (chevron up /
// chevron down / Done). Native iOS text fields have no such bar, so drop it to
// make the keyboard look like a native app's instead of a web view's.
static UIView *CodexiaNoInputAccessoryView(id self, SEL _cmd) { return nil; }

__attribute__((constructor)) static void CodexiaRemoveWebViewInputAccessoryBar(void) {
  Class contentView = NSClassFromString(@"WKContentView");
  if (contentView == nil) {
    return;
  }
  class_replaceMethod(contentView, @selector(inputAccessoryView),
                      (IMP)CodexiaNoInputAccessoryView, "@@:");
}
