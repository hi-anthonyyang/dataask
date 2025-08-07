import { api } from './api';

export interface DataFrame {
  id: string;
  name: string;
  columns: string[];
  shape: [number, number];
  dtypes: Record<string, string>;
  uploadedAt: Date;
}

export interface DataFrameQueryResult {
  data: any[];
  columns: string[];
  rowCount: number;
  executionTime: number;
}

export interface FileUploadResponse {
  dataframeId: string;
  name: string;
  info: any;
  preview: {
    data: any[];
    columns: string[];
    rowCount: number;
  };
  message: string;
}

export const dataframeService = {
  // Upload a file and create a DataFrame
  async uploadFile(file: File): Promise<FileUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    return api.upload('/api/files/upload', formData);
  },

  // List all DataFrames
  async listDataFrames(): Promise<{ dataframes: DataFrame[] }> {
    return api.get('/api/files/dataframes');
  },

  // Get DataFrame info
  async getDataFrameInfo(id: string): Promise<{ info: any; stats: any }> {
    return api.get(`/api/dataframes/${id}/info`);
  },

  // Get DataFrame preview
  async getDataFramePreview(id: string, rows: number = 10): Promise<DataFrameQueryResult> {
    return api.get(`/api/files/dataframes/${id}/preview?rows=${rows}`);
  },

  // Get DataFrame profile
  async getDataFrameProfile(id: string): Promise<{ profile: any[] }> {
    return api.get(`/api/dataframes/${id}/profile`);
  },

  // Execute pandas code on DataFrame
  async executePandasCode(dataframeId: string, code: string): Promise<DataFrameQueryResult> {
    const response = await api.post(`/api/dataframes/${dataframeId}/execute`, { code });
    return response.result;
  },

  // Delete DataFrame
  async deleteDataFrame(id: string): Promise<void> {
    await api.delete(`/api/files/dataframes/${id}`);
  },

  // Generate pandas code from natural language
  async generatePandasCode(query: string, dataframeInfo: any): Promise<{ code: string; explanation: string }> {
    return api.post('/api/llm/nl-to-pandas', {
      query,
      dataframeInfo
    });
  },

  // Analyze DataFrame results
  async analyzeResults(data: any[], query: string): Promise<any> {
    return api.post('/api/llm/analyze', {
      data,
      query,
      context: 'pandas DataFrame analysis'
    });
  }
};