import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  RocketIcon,
  TargetIcon,
  HeartIcon,
  ShieldIcon,
  UsersIcon,
  PlusIcon,
  PencilIcon,
  XIcon,
  CheckIcon,
  TrashIcon,
  BuildingIcon,
  GripVerticalIcon
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { db } from "@/lib/firebase";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { usePlanYear } from "@/contexts/PlanYearContext";

interface SortableStrategicAnchorProps {
  item: { id: string; text: string };
  editingField: string | null;
  editValue: string;
  editDescription: string;
  setEditValue: (value: string) => void;
  setEditDescription: (value: string) => void;
  handleEditListItem: (fieldPath: 'coreValues' | 'strategicAnchors', itemId: string, newValue: string, newDescription?: string) => Promise<void>;
  handleEdit: (fieldPath: string, currentValue: string) => void;
  setEditingField: (field: string | null) => void;
  handleCancel: () => void;
  handleDeleteItem: (fieldPath: 'coreValues' | 'strategicAnchors', itemId: string) => Promise<void>;
}

function SortableStrategicAnchor({ 
  item, 
  editingField, 
  editValue, 
  editDescription,
  setEditValue,
  setEditDescription,
  handleEditListItem,
  handleEdit,
  setEditingField,
  handleCancel,
  handleDeleteItem 
}: SortableStrategicAnchorProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className="group border border-border rounded-lg p-3 bg-muted"
      data-testid={`strategic-anchor-${item.id}`}
    >
      {editingField === `strategicAnchors.${item.id}` ? (
        <div className="space-y-2">
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            placeholder="Text"
            className="bg-background border-border text-foreground"
            autoFocus
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                handleEditListItem('strategicAnchors', item.id, editValue);
                setEditingField(null);
                setEditValue("");
              }}
              className="text-green-600 hover:text-green-700"
              data-testid={`button-save-item-${item.id}`}
            >
              <CheckIcon className="h-4 w-4 mr-1" />
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCancel}
              className="text-red-600 hover:text-red-700"
              data-testid={`button-cancel-item-${item.id}`}
            >
              <XIcon className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-2">
          <div 
            {...attributes} 
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors pt-1"
            data-testid={`drag-handle-${item.id}`}
          >
            <GripVerticalIcon className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <h4 className="font-medium text-foreground">{item.text}</h4>
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                handleEdit(`strategicAnchors.${item.id}`, item.text);
              }}
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              data-testid={`button-edit-item-${item.id}`}
            >
              <PencilIcon className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => handleDeleteItem('strategicAnchors', item.id)}
              className="h-6 w-6 text-red-600 hover:text-red-700"
              data-testid={`button-delete-item-${item.id}`}
            >
              <TrashIcon className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

interface CoreValue {
  id: string;
  name: string;
  description: string;
}

interface StrategicAnchor {
  id: string;
  text: string;
}

interface FoundationData {
  corePurpose: string;
  mission: string;
  coreValues: CoreValue[];
  strategicAnchors: StrategicAnchor[];
  coreCustomer: string;
  brandPromise: string;
  corePurposeTitle?: string;
  missionTitle?: string;
  brandPromiseTitle?: string;
  coreCustomerTitle?: string;
  coreValuesTitle?: string;
  strategicAnchorsTitle?: string;
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const getEmptyFoundationData = (): FoundationData => ({
  corePurpose: "",
  mission: "",
  coreValues: [],
  strategicAnchors: [],
  coreCustomer: "",
  brandPromise: "",
  corePurposeTitle: "Core Purpose",
  missionTitle: "Mission",
  brandPromiseTitle: "Brand Promise",
  coreCustomerTitle: "Core Customer",
  coreValuesTitle: "Culture Drivers",
  strategicAnchorsTitle: "Strategic Anchors"
});

export default function Foundation() {
  const { toast } = useToast();
  const { companyId } = usePlanYear();
  const [foundationData, setFoundationData] = useState<FoundationData>(getEmptyFoundationData());
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    const docRef = doc(db, 'companies', companyId, 'roadmap', 'foundation');
    const unsubscribe = onSnapshot(docRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data() as FoundationData;
        // Ensure arrays exist
        setFoundationData({
          ...getEmptyFoundationData(),
          ...data,
          coreValues: data.coreValues || [],
          strategicAnchors: data.strategicAnchors || []
        });
      } else {
        setFoundationData(getEmptyFoundationData());
      }
      setIsLoading(false);
    }, (error) => {
      setIsError(true);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [companyId]);

  const saveFoundationData = async (newData: FoundationData) => {
    try {
      const docRef = doc(db, 'companies', companyId, 'roadmap', 'foundation');
      await setDoc(docRef, newData, { merge: true });
      toast({
        title: "Success",
        description: "Foundation data has been saved",
        duration: 1500,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save foundation data",
        variant: "destructive",
      });
    }
  };

  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [addingItem, setAddingItem] = useState<string | null>(null);
  const [newItemValue, setNewItemValue] = useState("");
  const [newItemDescription, setNewItemDescription] = useState("");

  const resetEditState = () => {
    setEditingField(null);
    setEditValue("");
    setEditDescription("");
    setAddingItem(null);
    setNewItemValue("");
    setNewItemDescription("");
  };

  const handleEdit = (fieldPath: string, currentValue: string) => {
    setEditingField(fieldPath);
    setEditValue(currentValue);
  };

  const handleCancel = () => {
    resetEditState();
  };

  const handleSave = async (fieldPath: keyof FoundationData) => {
    const updatedData = {
      ...foundationData,
      [fieldPath]: editValue
    };
    
    await saveFoundationData(updatedData);
    resetEditState();
  };

  const updateListField = async (
    fieldPath: 'coreValues' | 'strategicAnchors',
    updater: (items: CoreValue[] | StrategicAnchor[]) => CoreValue[] | StrategicAnchor[]
  ) => {
    const currentItems = foundationData[fieldPath];
    const updatedItems = updater(currentItems);
    
    const updatedData = {
      ...foundationData,
      [fieldPath]: updatedItems
    };
    
    await saveFoundationData(updatedData);
  };

  const renderEditableTitle = (icon: React.ReactNode, titleField: string, titleValue: string) => {
    const isEditing = editingField === titleField;
    
    return (
      <div className="flex items-center gap-2 text-lg text-foreground group">
        {icon}
        {isEditing ? (
          <div className="flex items-center gap-2 flex-1">
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="h-7 text-sm bg-background border-border text-foreground"
              autoFocus
              data-testid={`input-${titleField}`}
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleSave(titleField as keyof FoundationData)}
              className="h-7 w-7 p-0 text-green-600 hover:text-green-700"
              data-testid={`button-save-${titleField}`}
            >
              <CheckIcon className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCancel}
              className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
              data-testid={`button-cancel-${titleField}`}
            >
              <XIcon className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <>
            <span>{titleValue}</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleEdit(titleField, titleValue)}
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
              data-testid={`button-edit-${titleField}`}
            >
              <PencilIcon className="h-3 w-3" />
            </Button>
          </>
        )}
      </div>
    );
  };

  const handleEditListItem = async (
    fieldPath: 'coreValues' | 'strategicAnchors',
    itemId: string,
    newValue: string,
    newDescription?: string
  ) => {
    if (fieldPath === 'coreValues') {
      await updateListField(fieldPath, (items) =>
        (items as CoreValue[]).map((item) =>
          item.id === itemId
            ? { ...item, name: newValue, description: newDescription || item.description }
            : item
        )
      );
    } else if (fieldPath === 'strategicAnchors') {
      await updateListField(fieldPath, (items) =>
        (items as StrategicAnchor[]).map((item) =>
          item.id === itemId ? { ...item, text: newValue } : item
        )
      );
    }
  };

  const handleAddItem = (fieldPath: 'coreValues' | 'strategicAnchors') => {
    setAddingItem(fieldPath);
    setNewItemValue("");
    setNewItemDescription("");
  };

  const handleSaveNewItem = async (fieldPath: 'coreValues' | 'strategicAnchors') => {
    if (!newItemValue.trim()) return;
    
    if (fieldPath === 'coreValues') {
      const newItem: CoreValue = {
        id: generateId(),
        name: newItemValue,
        description: newItemDescription
      };
      
      await updateListField(fieldPath, (items) => [...(items as CoreValue[]), newItem]);
    } else if (fieldPath === 'strategicAnchors') {
      const newItem: StrategicAnchor = {
        id: generateId(),
        text: newItemValue
      };
      
      await updateListField(fieldPath, (items) => [...(items as StrategicAnchor[]), newItem]);
    }
    
    resetEditState();
  };

  const handleDeleteItem = async (
    fieldPath: 'coreValues' | 'strategicAnchors',
    itemId: string
  ) => {
    if (fieldPath === 'coreValues') {
      await updateListField(fieldPath, (items) =>
        (items as CoreValue[]).filter((item) => item.id !== itemId)
      );
    } else {
      await updateListField(fieldPath, (items) =>
        (items as StrategicAnchor[]).filter((item) => item.id !== itemId)
      );
    }
  };

  const renderEditableField = (fieldPath: keyof FoundationData, value: string, multiline = false) => {
    const isEditing = editingField === fieldPath;
    const displayValue = value || (multiline ? "Click to add..." : "Click to add...");
    
    if (isEditing) {
      return (
        <div className="flex gap-2 items-start">
          {multiline ? (
            <Textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="flex-1 bg-background border-border text-foreground"
              autoFocus
              rows={3}
              placeholder="Enter text..."
            />
          ) : (
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="flex-1 bg-background border-border text-foreground"
              autoFocus
              placeholder="Enter text..."
            />
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={() => handleSave(fieldPath)}
            className="h-8 w-8 text-green-600 hover:text-green-700"
            data-testid={`button-save-${fieldPath}`}
          >
            <CheckIcon className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={resetEditState}
            className="h-8 w-8 text-red-600 hover:text-red-700"
            data-testid={`button-cancel-${fieldPath}`}
          >
            <XIcon className="h-4 w-4" />
          </Button>
        </div>
      );
    }
    
    return (
      <div className="flex gap-2 items-start group">
        <p className={`flex-1 ${multiline ? 'text-sm leading-relaxed whitespace-pre-wrap' : 'text-lg font-medium'} text-foreground ${!value ? 'opacity-50 italic' : ''}`}>
          {displayValue}
        </p>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => handleEdit(fieldPath, value)}
          className="h-6 w-6 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
          data-testid={`button-edit-${fieldPath}`}
        >
          <PencilIcon className="h-3 w-3" />
        </Button>
      </div>
    );
  };

  const renderEditableList = (
    fieldPath: 'coreValues' | 'strategicAnchors',
    items: CoreValue[] | StrategicAnchor[],
    hasDescription = false
  ) => {
    return (
      <div className="space-y-3">
        {items.length === 0 && !addingItem && (
          <p className="text-sm text-muted-foreground italic text-center py-4">
            No items yet. Click "Add New Item" to get started.
          </p>
        )}
        
        {items.map((item) => {
          const itemId = `${fieldPath}.${item.id}`;
          const isEditing = editingField === itemId;
          const itemName = 'name' in item ? item.name : item.text;
          
          return (
            <div key={item.id} className="group border border-border rounded-lg p-3 bg-muted">
              {isEditing ? (
                <div className="space-y-2">
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    placeholder={hasDescription ? "Name" : "Text"}
                    className="bg-background border-border text-foreground"
                    autoFocus
                  />
                  {hasDescription && (
                    <Textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Description"
                      className="bg-background border-border text-foreground"
                      rows={3}
                    />
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        handleEditListItem(fieldPath, item.id, editValue, hasDescription ? editDescription : undefined);
                        resetEditState();
                      }}
                      className="text-green-600 hover:text-green-700"
                      data-testid={`button-save-item-${item.id}`}
                    >
                      <CheckIcon className="h-4 w-4 mr-1" />
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={resetEditState}
                      className="text-red-600 hover:text-red-700"
                      data-testid={`button-cancel-item-${item.id}`}
                    >
                      <XIcon className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-foreground mb-1">{itemName}</h4>
                      {hasDescription && 'description' in item && item.description && (
                        <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                      )}
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          handleEdit(itemId, itemName);
                          if (hasDescription && 'description' in item) {
                            setEditDescription(item.description || "");
                          }
                        }}
                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                        data-testid={`button-edit-item-${item.id}`}
                      >
                        <PencilIcon className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDeleteItem(fieldPath, item.id)}
                        className="h-6 w-6 text-red-600 hover:text-red-700"
                        data-testid={`button-delete-item-${item.id}`}
                      >
                        <TrashIcon className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })}
        
        {addingItem === fieldPath ? (
          <div className="border border-border rounded-lg p-3 bg-muted">
            <div className="space-y-2">
              <Input
                value={newItemValue}
                onChange={(e) => setNewItemValue(e.target.value)}
                placeholder={hasDescription ? "Name" : "Text"}
                className="bg-background border-border text-foreground"
                autoFocus
              />
              {hasDescription && (
                <Textarea
                  value={newItemDescription}
                  onChange={(e) => setNewItemDescription(e.target.value)}
                  placeholder="Description"
                  className="bg-background border-border text-foreground"
                  rows={3}
                />
              )}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => handleSaveNewItem(fieldPath)}
                  className="bg-accent text-accent-foreground hover:bg-accent/80"
                  disabled={!newItemValue.trim()}
                  data-testid={`button-save-new-${fieldPath}`}
                >
                  <CheckIcon className="h-4 w-4 mr-1" />
                  Add
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={resetEditState}
                  className="text-red-600 hover:text-red-700"
                  data-testid={`button-cancel-new-${fieldPath}`}
                >
                  <XIcon className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            onClick={() => handleAddItem(fieldPath)}
            className="w-full border-dashed border-border text-muted-foreground hover:bg-accent"
            data-testid={`button-add-${fieldPath}`}
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Add New Item
          </Button>
        )}
      </div>
    );
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = foundationData.strategicAnchors.findIndex(item => item.id === active.id);
      const newIndex = foundationData.strategicAnchors.findIndex(item => item.id === over.id);
      
      const newItems = arrayMove(foundationData.strategicAnchors, oldIndex, newIndex);
      
      await updateListField('strategicAnchors', () => newItems);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <BuildingIcon className="w-8 h-8 animate-pulse text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">Loading foundation data...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-600 mb-2">Failed to load foundation data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <div className="flex items-center gap-3 mb-2">
          <BuildingIcon className="w-6 h-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold text-foreground">Foundation</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Define your organization's core identity and fundamental principles
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle>
              {renderEditableTitle(
                <RocketIcon className="w-5 h-5" />,
                "corePurposeTitle",
                foundationData.corePurposeTitle || "Core Purpose"
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {renderEditableField("corePurpose", foundationData.corePurpose, true)}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle>
              {renderEditableTitle(
                <TargetIcon className="w-5 h-5" />,
                "missionTitle",
                foundationData.missionTitle || "Mission"
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {renderEditableField("mission", foundationData.mission, true)}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle>
              {renderEditableTitle(
                <ShieldIcon className="w-5 h-5" />,
                "brandPromiseTitle",
                foundationData.brandPromiseTitle || "Brand Promise"
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {renderEditableField("brandPromise", foundationData.brandPromise)}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle>
              {renderEditableTitle(
                <UsersIcon className="w-5 h-5" />,
                "coreCustomerTitle",
                foundationData.coreCustomerTitle || "Core Customer"
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {renderEditableField("coreCustomer", foundationData.coreCustomer, true)}
          </CardContent>
        </Card>

        <Card className="bg-card border-border lg:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle>
              {renderEditableTitle(
                <HeartIcon className="w-5 h-5" />,
                "coreValuesTitle",
                foundationData.coreValuesTitle || "Culture Drivers"
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {renderEditableList("coreValues", foundationData.coreValues, true)}
          </CardContent>
        </Card>

        <Card className="bg-card border-border lg:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle>
              {renderEditableTitle(
                <TargetIcon className="w-5 h-5" />,
                "strategicAnchorsTitle",
                foundationData.strategicAnchorsTitle || "Strategic Anchors"
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DndContext 
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext 
                items={foundationData.strategicAnchors.map(item => item.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {foundationData.strategicAnchors.map((item) => (
                    <SortableStrategicAnchor
                      key={item.id}
                      item={item}
                      editingField={editingField}
                      editValue={editValue}
                      editDescription={editDescription}
                      setEditValue={setEditValue}
                      setEditDescription={setEditDescription}
                      handleEditListItem={handleEditListItem}
                      handleEdit={handleEdit}
                      setEditingField={setEditingField}
                      handleCancel={handleCancel}
                      handleDeleteItem={handleDeleteItem}
                    />
                  ))}
                  
                  {addingItem === 'strategicAnchors' ? (
                    <div className="border border-border rounded-lg p-3 bg-muted">
                      <div className="space-y-2">
                        <Input
                          value={newItemValue}
                          onChange={(e) => setNewItemValue(e.target.value)}
                          placeholder="Text"
                          className="bg-background border-border text-foreground"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleSaveNewItem('strategicAnchors')}
                            className="bg-accent text-accent-foreground hover:bg-accent/80"
                            data-testid="button-save-new-strategicAnchors"
                          >
                            <CheckIcon className="h-4 w-4 mr-1" />
                            Add
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleCancel}
                            className="text-red-600 hover:text-red-700"
                            data-testid="button-cancel-new-strategicAnchors"
                          >
                            <XIcon className="h-4 w-4 mr-1" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => handleAddItem('strategicAnchors')}
                      className="w-full border-dashed border-border text-muted-foreground hover:bg-accent"
                      data-testid="button-add-strategicAnchors"
                    >
                      <PlusIcon className="h-4 w-4 mr-2" />
                      Add New Item
                    </Button>
                  )}
                </div>
              </SortableContext>
            </DndContext>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
