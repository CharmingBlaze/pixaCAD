package main

import (
	"context"
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App exposes native desktop APIs to the embedded frontend.
type App struct {
	ctx context.Context
}

// NewApp creates the Wails application struct.
func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// IsDesktop reports desktop mode to the frontend.
func (a *App) IsDesktop() bool {
	return true
}

// SaveTextFile opens a save dialog and writes UTF-8 text.
func (a *App) SaveTextFile(defaultName, content, dialogTitle string) (string, error) {
	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           dialogTitle,
		DefaultFilename: defaultName,
		Filters: []runtime.FileFilter{
			{DisplayName: "pixaCAD project", Pattern: "*.pixacad.json;*.json"},
			{DisplayName: "All files", Pattern: "*.*"},
		},
	})
	if err != nil {
		return "", err
	}
	if path == "" {
		return "", nil
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		return "", fmt.Errorf("write file: %w", err)
	}
	return path, nil
}

// OpenTextFile opens a file dialog and returns file contents.
func (a *App) OpenTextFile(dialogTitle string) (string, error) {
	path, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: dialogTitle,
		Filters: []runtime.FileFilter{
			{DisplayName: "pixaCAD project", Pattern: "*.pixacad.json;*.khed.json;*.json"},
			{DisplayName: "All files", Pattern: "*.*"},
		},
	})
	if err != nil {
		return "", err
	}
	if path == "" {
		return "", nil
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("read file: %w", err)
	}
	return string(data), nil
}

// SaveBinaryFile opens a save dialog and writes base64-encoded bytes.
func (a *App) SaveBinaryFile(defaultName, base64Data, dialogTitle string) (string, error) {
	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           dialogTitle,
		DefaultFilename: defaultName,
		Filters: []runtime.FileFilter{
			{DisplayName: "All files", Pattern: "*.*"},
		},
	})
	if err != nil {
		return "", err
	}
	if path == "" {
		return "", nil
	}
	raw, err := base64.StdEncoding.DecodeString(base64Data)
	if err != nil {
		return "", fmt.Errorf("decode data: %w", err)
	}
	if err := os.WriteFile(path, raw, 0o644); err != nil {
		return "", fmt.Errorf("write file: %w", err)
	}
	return path, nil
}

// ExportFilePayload is one file written during folder export.
type ExportFilePayload struct {
	Name string `json:"name"`
	Data string `json:"data"`
}

// ExportFiles writes multiple base64-encoded files into a user-chosen folder.
func (a *App) ExportFiles(files []ExportFilePayload) (string, error) {
	dir, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title:                "Select export folder",
		CanCreateDirectories: true,
	})
	if err != nil {
		return "", err
	}
	if dir == "" {
		return "", nil
	}
	for _, file := range files {
		raw, err := base64.StdEncoding.DecodeString(file.Data)
		if err != nil {
			return "", fmt.Errorf("decode %s: %w", file.Name, err)
		}
		target := filepath.Join(dir, file.Name)
		if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			return "", fmt.Errorf("create folder for %s: %w", file.Name, err)
		}
		if err := os.WriteFile(target, raw, 0o644); err != nil {
			return "", fmt.Errorf("write %s: %w", file.Name, err)
		}
	}
	return dir, nil
}
