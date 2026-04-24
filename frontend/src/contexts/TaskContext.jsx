import React, { createContext, useContext, useState, useCallback } from 'react';

const TaskContext = createContext();

export const TaskProvider = ({ children }) => {
    const [taskState, setTaskState] = useState({
        isProcessing: false,
        processingMessage: '',
        progress: 0,
        taskId: null
    });

    const updateTask = useCallback((updates) => {
        setTaskState(prev => ({ ...prev, ...updates }));
    }, []);

    const resetTask = useCallback(() => {
        setTaskState({
            isProcessing: false,
            processingMessage: '',
            progress: 0,
            taskId: null
        });
    }, []);

    return (
        <TaskContext.Provider value={{ taskState, updateTask, resetTask }}>
            {children}
        </TaskContext.Provider>
    );
};

export const useTask = () => {
    const context = useContext(TaskContext);
    if (!context) {
        throw new Error('useTask must be used within a TaskProvider');
    }
    return context;
};
