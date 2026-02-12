
import React, { useState, useEffect, useMemo } from 'react';
import { Sidebar } from '../../components/feature/Sidebar';
import Header from '../../components/feature/Header';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import Badge from '../../components/base/Badge';
import { taskService, type Task } from '../../services/taskService';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';

const TasksPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'completed'>('all');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<Task>>({
    title: '',
    description: '',
    assignee: '',
    assigneeName: '',
    dueDate: '',
    isCompleted: false
  });

  const fetchTasks = async () => {
    setIsLoading(true);
    try {
      const data = await taskService.getAllTasks();
      setTasks(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Failed to load tasks');
      setTasks([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersData = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        name: (doc.data().firstName || doc.data().email || 'Unknown User') as string
      }));
      setUsers(usersData);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  useEffect(() => {
    fetchTasks();
    fetchUsers();
  }, []);

  const filteredTasks = useMemo(() => {
    if (!Array.isArray(tasks)) return [];
    
    let filtered = tasks;

    // Filter by status
    if (activeTab === 'pending') {
      filtered = filtered.filter(task => !task.isCompleted);
    } else if (activeTab === 'completed') {
      filtered = filtered.filter(task => task.isCompleted);
    }

    // Filter by user
    if (selectedUser !== 'all') {
      filtered = filtered.filter(task => task.assignee === selectedUser);
    }

    return filtered;
  }, [tasks, activeTab, selectedUser]);

  const handleOpenNewModal = () => {
    setFormData({
      title: '',
      description: '',
      assignee: '',
      assigneeName: '',
      dueDate: new Date().toISOString().split('T')[0],
      isCompleted: false
    });
    setShowModal(true);
  };

  const handleOpenEditModal = (task: Task) => {
    setFormData(task);
    setShowModal(true);
    setSelectedTask(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      // Get assignee name from users list
      const selectedUserData = users.find(u => u.id === formData.assignee);
      const taskData = {
        ...formData,
        assigneeName: selectedUserData?.name || formData.assigneeName || ''
      } as Task;

      if (formData.id) {
        await taskService.updateTask(formData.id, taskData);
      } else {
        await taskService.createTask(taskData);
      }

      await fetchTasks();
      setShowModal(false);
    } catch (err) {
      console.error(err);
      setError('Failed to save task');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    setIsLoading(true);
    try {
      await taskService.deleteTask(id);
      await fetchTasks();
      setSelectedTask(null);
    } catch (err) {
      setError('Failed to delete task');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleComplete = async (task: Task) => {
    try {
      await taskService.updateTask(task.id!, { isCompleted: !task.isCompleted });
      await fetchTasks();
    } catch (err) {
      console.error('Error toggling task completion:', err);
    }
  };

  const isOverdue = (dueDate: string, isCompleted: boolean) => {
    if (isCompleted) return false;
    const today = new Date().toISOString().split('T')[0];
    return dueDate < today;
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Tasks</h1>
                <p className="text-gray-600 dark:text-gray-400">Manage and track tasks for users.</p>
              </div>
              <Button color="blue" onClick={handleOpenNewModal}>
                <i className="ri-add-line mr-2"></i>
                New Task
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="mb-6 flex flex-wrap gap-4 items-center">
            {/* Status Tabs */}
            <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
              {(['all', 'pending', 'completed'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors capitalize ${
                    activeTab === tab
                      ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {tab} ({
                    tab === 'all' 
                      ? tasks.length 
                      : tab === 'pending'
                      ? tasks.filter(t => !t.isCompleted).length
                      : tasks.filter(t => t.isCompleted).length
                  })
                </button>
              ))}
            </div>

            {/* User Filter */}
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="all">All Users</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>{user.name}</option>
              ))}
            </select>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg">
              {error}
            </div>
          )}

          {isLoading && !showModal ? (
            <div className="flex items-center justify-center h-64">
              <i className="ri-loader-4-line text-4xl animate-spin text-blue-600"></i>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTasks.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
                  <i className="ri-task-line text-4xl text-gray-400 mb-2"></i>
                  <p className="text-gray-500 dark:text-gray-400">No tasks found.</p>
                </div>
              ) : (
                filteredTasks.map((task) => (
                  <Card 
                    key={task.id} 
                    className={`hover:shadow-lg transition-shadow cursor-pointer ${
                      isOverdue(task.dueDate, task.isCompleted) ? 'border-l-4 border-red-500' : ''
                    }`}
                    onClick={() => setSelectedTask(task)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4 flex-1">
                        {/* Checkbox */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleComplete(task);
                          }}
                          className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                            task.isCompleted
                              ? 'bg-green-500 border-green-500'
                              : 'border-gray-300 dark:border-gray-600 hover:border-green-500'
                          }`}
                        >
                          {task.isCompleted && (
                            <i className="ri-check-line text-white text-sm"></i>
                          )}
                        </button>

                        <div className="flex-1">
                          <h3 className={`font-semibold text-gray-900 dark:text-white ${
                            task.isCompleted ? 'line-through opacity-60' : ''
                          }`}>
                            {task.title}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {task.description}
                          </p>
                          <div className="flex items-center gap-4 mt-3 text-sm text-gray-500 dark:text-gray-400">
                            <span className="flex items-center gap-1">
                              <i className="ri-user-line"></i>
                              {task.assigneeName || 'Unassigned'}
                            </span>
                            <span className="flex items-center gap-1">
                              <i className="ri-calendar-line"></i>
                              {task.dueDate}
                            </span>
                            {isOverdue(task.dueDate, task.isCompleted) && (
                              <Badge color="red">Overdue</Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {task.isCompleted ? (
                          <Badge color="green">Completed</Badge>
                        ) : (
                          <Badge color="yellow">Pending</Badge>
                        )}
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* Task Detail Modal */}
          {selectedTask && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
              <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Task Details</h2>
                    <button
                      onClick={() => setSelectedTask(null)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <i className="ri-close-line text-xl text-gray-600 dark:text-gray-400"></i>
                    </button>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">{selectedTask.title}</h3>
                      {selectedTask.isCompleted ? (
                        <Badge color="green" className="mt-2">Completed</Badge>
                      ) : (
                        <Badge color="yellow" className="mt-2">Pending</Badge>
                      )}
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-xl space-y-4">
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Description</h4>
                        <p className="text-gray-600 dark:text-gray-300">{selectedTask.description}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Assigned To</h4>
                          <p className="text-gray-600 dark:text-gray-300">{selectedTask.assigneeName || 'Unassigned'}</p>
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Due Date</h4>
                          <p className="text-gray-600 dark:text-gray-300">{selectedTask.dueDate}</p>
                        </div>
                      </div>

                      {isOverdue(selectedTask.dueDate, selectedTask.isCompleted) && (
                        <div className="bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-3 rounded-lg">
                          <p className="text-red-600 dark:text-red-400 font-medium">
                            <i className="ri-error-warning-line mr-2"></i>
                            This task is overdue
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-3 pt-2">
                      <Button color="blue" className="flex-1" onClick={() => handleOpenEditModal(selectedTask)}>
                        <i className="ri-edit-line mr-2"></i>
                        Edit
                      </Button>
                      <Button
                        color={selectedTask.isCompleted ? 'blue' : 'green'}
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          handleToggleComplete(selectedTask);
                          setSelectedTask(null);
                        }}
                      >
                        <i className={`${selectedTask.isCompleted ? 'ri-close-circle-line' : 'ri-check-line'} mr-2`}></i>
                        {selectedTask.isCompleted ? 'Mark Incomplete' : 'Mark Complete'}
                      </Button>
                      <Button color="red" variant="outline" className="flex-1" onClick={() => selectedTask.id && handleDelete(selectedTask.id)}>
                        <i className="ri-delete-bin-line mr-2"></i>
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Create/Edit Modal */}
          {showModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
              <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
                <form onSubmit={handleSubmit} className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      {formData.id ? 'Edit Task' : 'New Task'}
                    </h2>
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <i className="ri-close-line text-xl text-gray-600 dark:text-gray-400"></i>
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
                      <input
                        type="text"
                        required
                        value={formData.title}
                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="e.g. Upload Medical Records"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                      <textarea
                        required
                        value={formData.description}
                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                        rows={3}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                        placeholder="Please upload your vaccination records..."
                      ></textarea>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assign To</label>
                        <select
                          required
                          value={formData.assignee}
                          onChange={e => setFormData({ ...formData, assignee: e.target.value })}
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                          <option value="">Select User</option>
                          {users.map(user => (
                            <option key={user.id} value={user.id}>{user.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Due Date</label>
                        <input
                          type="date"
                          required
                          value={formData.dueDate}
                          onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    </div>

                    {formData.id && (
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="completed"
                          checked={formData.isCompleted}
                          onChange={e => setFormData({ ...formData, isCompleted: e.target.checked })}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                        />
                        <label htmlFor="completed" className="text-sm text-gray-700 dark:text-gray-300">
                          Mark as completed
                        </label>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 mt-6">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setShowModal(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" color="blue" className="flex-1" disabled={isLoading}>
                      {isLoading ? 'Saving...' : 'Save Task'}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default TasksPage;
