use crate::services::path_validator::validate_path;
use crate::services::{
    read_directory_tree as do_read_tree, read_file_content, write_file_content, FileNode,
};

#[tauri::command]
pub fn read_directory_tree(path: String) -> Result<FileNode, String> {
    let validated_path = validate_path(&path)?;
    do_read_tree(&validated_path.to_string_lossy())
}

#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    let validated_path = validate_path(&path)?;
    read_file_content(&validated_path.to_string_lossy())
}

#[tauri::command]
pub fn write_file(path: String, content: String) -> Result<(), String> {
    let validated_path = validate_path(&path)?;
    write_file_content(&validated_path.to_string_lossy(), &content)
}
