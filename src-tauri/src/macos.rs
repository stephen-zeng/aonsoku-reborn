use objc::{
    runtime::{Class, Object, Sel, NO, YES},
    Message,
};

type ObjcId = *mut Object;

pub fn configure_media_remote_commands() {
    let Some(command_center_class) = Class::get("MPRemoteCommandCenter") else {
        return;
    };

    unsafe {
        let Ok(command_center) = command_center_class
            .send_message::<(), ObjcId>(Sel::register("sharedCommandCenter"), ())
        else {
            return;
        };

        if command_center.is_null() {
            return;
        }

        enable_command(command_center, "previousTrackCommand");
        enable_command(command_center, "nextTrackCommand");
        enable_command(command_center, "changePlaybackPositionCommand");
        disable_command(command_center, "seekBackwardCommand");
        disable_command(command_center, "seekForwardCommand");
        disable_command(command_center, "skipBackwardCommand");
        disable_command(command_center, "skipForwardCommand");
    }
}

unsafe fn enable_command(command_center: ObjcId, command_selector: &str) {
    let command = remote_command(command_center, command_selector);
    if command.is_null() {
        return;
    }
    let _: Result<(), _> = (*command).send_message(Sel::register("setEnabled:"), (YES,));
}

unsafe fn disable_command(command_center: ObjcId, command_selector: &str) {
    let command = remote_command(command_center, command_selector);
    if command.is_null() {
        return;
    }

    let _: Result<(), _> = (*command).send_message(Sel::register("setEnabled:"), (NO,));
    let _: Result<(), _> = (*command).send_message(
        Sel::register("removeTarget:"),
        (std::ptr::null_mut::<Object>(),),
    );
}

unsafe fn remote_command(command_center: ObjcId, command_selector: &str) -> ObjcId {
    match (*command_center).send_message::<(), ObjcId>(Sel::register(command_selector), ()) {
        Ok(command) => command,
        Err(_) => std::ptr::null_mut(),
    }
}
