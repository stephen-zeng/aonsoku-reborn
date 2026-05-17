#import "ObjCExceptionCatcher.h"

@implementation ObjCExceptionCatcher

+ (BOOL)performBlock:(void (NS_NOESCAPE ^)(void))block
               error:(NSError * _Nullable *)error {
    @try {
        block();
        return YES;
    } @catch (NSException *exception) {
        if (error) {
            *error = [NSError errorWithDomain:@"NSExceptionDomain"
                                         code:-1
                                     userInfo:@{
                NSLocalizedDescriptionKey: exception.reason ?: exception.name
            }];
        }
        return NO;
    }
}

@end
