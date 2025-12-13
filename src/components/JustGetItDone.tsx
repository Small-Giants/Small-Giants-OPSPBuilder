import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { 
  PlusIcon, 
  XIcon, 
  CheckIcon, 
  PencilIcon, 
  TrashIcon, 
  ListTodoIcon,
  Loader2
} from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, orderBy, query } from "firebase/firestore";

interface JustGetItDoneItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
}

const DEFAULT_COMPANY_ID = "default-company";

export default function JustGetItDone() {
  const { toast } = useToast();
  
  const [newItemText, setNewItemText] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [items, setItems] = useState<JustGetItDoneItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const collectionRef = collection(db, 'companies', DEFAULT_COMPANY_ID, 'just-get-it-done');
    const q = query(collectionRef, orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedItems: JustGetItDoneItem[] = [];
      snapshot.forEach((doc) => {
        fetchedItems.push({ id: doc.id, ...doc.data() } as JustGetItDoneItem);
      });
      setItems(fetchedItems);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching just-get-it-done items:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAddItem = async () => {
    if (!newItemText.trim()) return;
    
    try {
      const collectionRef = collection(db, 'companies', DEFAULT_COMPANY_ID, 'just-get-it-done');
      await addDoc(collectionRef, {
        text: newItemText.trim(),
        completed: false,
        createdAt: new Date().toISOString()
      });
      setNewItemText("");
      toast({ title: "Success", description: "Item added successfully" });
    } catch (error) {
      console.error("Error adding item:", error);
      toast({ title: "Error", description: "Failed to add item", variant: "destructive" });
    }
  };

  const handleToggleComplete = async (item: JustGetItDoneItem) => {
    try {
      const docRef = doc(db, 'companies', DEFAULT_COMPANY_ID, 'just-get-it-done', item.id);
      await updateDoc(docRef, { completed: !item.completed });
    } catch (error) {
      console.error("Error toggling complete:", error);
      toast({ title: "Error", description: "Failed to update item", variant: "destructive" });
    }
  };

  const handleStartEdit = (item: JustGetItDoneItem) => {
    setEditingItemId(item.id);
    setEditingText(item.text);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editingText.trim()) return;
    
    try {
      const docRef = doc(db, 'companies', DEFAULT_COMPANY_ID, 'just-get-it-done', id);
      await updateDoc(docRef, { text: editingText.trim() });
      setEditingItemId(null);
      setEditingText("");
      toast({ title: "Success", description: "Item updated successfully" });
    } catch (error) {
      console.error("Error updating item:", error);
      toast({ title: "Error", description: "Failed to update item", variant: "destructive" });
    }
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setEditingText("");
  };

  const handleDelete = async (id: string) => {
    try {
      const docRef = doc(db, 'companies', DEFAULT_COMPANY_ID, 'just-get-it-done', id);
      await deleteDoc(docRef);
      toast({ title: "Success", description: "Item deleted successfully" });
    } catch (error) {
      console.error("Error deleting item:", error);
      toast({ title: "Error", description: "Failed to delete item", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
          <p className="text-muted-foreground">Loading items...</p>
        </div>
      </div>
    );
  }

  const sortedItems = [...items].sort((a, b) => {
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <div className="flex items-center gap-3 mb-2">
          <ListTodoIcon className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Just Get It Done</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Quick action items that need to be completed
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex gap-2">
            <Input
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              placeholder="Add a new item..."
              className="flex-1"
              onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
              data-testid="input-new-item"
            />
            <Button
              onClick={handleAddItem}
              disabled={!newItemText.trim()}
              data-testid="button-add-item"
            >
              <PlusIcon className="w-4 h-4 mr-2" />
              Add
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-2">
          {sortedItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ListTodoIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No items yet. Add your first item above.</p>
            </div>
          ) : (
            sortedItems.map((item) => (
              <div
                key={item.id}
                className={`group border rounded-lg p-3 transition-all ${
                  item.completed
                    ? 'bg-muted/30 border-border/50'
                    : 'bg-card border-border'
                }`}
                data-testid={`item-${item.id}`}
              >
                {editingItemId === item.id ? (
                  <div className="flex gap-2">
                    <Input
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      className="flex-1"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit(item.id);
                        if (e.key === 'Escape') handleCancelEdit();
                      }}
                      data-testid={`input-edit-${item.id}`}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleSaveEdit(item.id)}
                      className="h-8 w-8 text-green-600 hover:text-green-500"
                      data-testid={`button-save-${item.id}`}
                    >
                      <CheckIcon className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleCancelEdit}
                      className="h-8 w-8 text-red-600 hover:text-red-500"
                      data-testid={`button-cancel-edit-${item.id}`}
                    >
                      <XIcon className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={item.completed}
                      onCheckedChange={() => handleToggleComplete(item)}
                      data-testid={`checkbox-complete-${item.id}`}
                    />
                    <span
                      className={`flex-1 ${
                        item.completed
                          ? 'text-muted-foreground line-through'
                          : 'text-foreground'
                      }`}
                      data-testid={`text-${item.id}`}
                    >
                      {item.text}
                    </span>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleStartEdit(item)}
                        className="h-6 w-6"
                        data-testid={`button-edit-${item.id}`}
                      >
                        <PencilIcon className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDelete(item.id)}
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        data-testid={`button-delete-${item.id}`}
                      >
                        <TrashIcon className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
